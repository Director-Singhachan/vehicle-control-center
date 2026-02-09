// Crew Service - Business logic for crew management and commission calculation
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];
type DeliveryTripCrew = Database['public']['Tables']['delivery_trip_crews']['Row'];
type CommissionRate = Database['public']['Tables']['commission_rates']['Row'];
type CommissionLog = Database['public']['Tables']['commission_logs']['Row'];

export interface CrewMemberWithDetails extends DeliveryTripCrew {
    staff?: {
        id: string;
        name: string;
        employee_code?: string;
        status: string;
    };
    replaced_by?: {
        id: string;
        name: string;
    } | null;
}

export interface CommissionCalculationResult {
    tripId: string;
    vehicleType?: string;
    serviceType?: string;
    totalItemsDelivered: number;
    rateApplied: number;
    totalCommission: number;
    crewMembers: Array<{
        staffId: string;
        staffName: string;
        role: string;
        workDurationHours: number;
        workPercentage: number;
        commissionAmount: number;
    }>;
}

export const crewService = {
    /**
     * Assign multiple crew members to a delivery trip
     * @param tripId - UUID of the delivery trip
     * @param staffIds - Array of staff UUIDs to assign
     * @param role - Role for all assigned staff ('driver' or 'helper')
     * @returns Array of created crew assignments
     */
    assignCrewToTrip: async (
        tripId: string,
        staffIds: string[],
        role: 'driver' | 'helper'
    ): Promise<CrewMemberWithDetails[]> => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        if (!staffIds || staffIds.length === 0) {
            throw new Error('At least one staff member must be provided');
        }

        // Validate trip exists
        const { data: trip, error: tripError } = await supabase
            .from('delivery_trips')
            .select('id, status')
            .eq('id', tripId)
            .single();

        if (tripError || !trip) {
            throw new Error(`Delivery trip not found: ${tripId}`);
        }

        // Check if trip is in a valid state for crew assignment
        // Allow adding crew to completed trips (for retroactive assignment)
        if (trip.status === 'cancelled') {
            throw new Error(`Cannot assign crew to ${trip.status} trip`);
        }

        // Enforce 1 driver per trip
        if (role === 'driver') {
            const { data: existingDrivers } = await supabase
                .from('delivery_trip_crews')
                .select('id, staff_id')
                .eq('delivery_trip_id', tripId)
                .eq('role', 'driver')
                .eq('status', 'active')
                .limit(1);

            if (existingDrivers && existingDrivers.length > 0) {
                throw new Error('ทริปนี้มีคนขับแล้ว กรุณาใช้การ "แทน" ถ้าต้องการเปลี่ยนคนขับ');
            }

            if (staffIds.length > 1) {
                throw new Error('สามารถกำหนดคนขับได้เพียง 1 คนต่อทริป');
            }
        }

        // Validate all staff members exist and are active
        const { data: staffMembers, error: staffError } = await supabase
            .from('service_staff')
            .select('id, name, status, employee_code')
            .in('id', staffIds);

        if (staffError) {
            console.error('[crewService] Error fetching staff:', staffError);
            throw staffError;
        }

        if (!staffMembers || staffMembers.length !== staffIds.length) {
            throw new Error('One or more staff members not found');
        }

        // Check for inactive staff
        const inactiveStaff = staffMembers.filter(s => s.status === 'inactive');
        if (inactiveStaff.length > 0) {
            throw new Error(
                `Cannot assign inactive staff: ${inactiveStaff.map(s => s.name).join(', ')}`
            );
        }

        // Batch insert crew assignments
        const crewAssignments = staffIds.map(staffId => ({
            delivery_trip_id: tripId,
            staff_id: staffId,
            role,
            status: 'active' as const,
            start_at: new Date().toISOString(),
            created_by: user.id,
            updated_by: user.id,
        }));

        const { data: insertedCrews, error: insertError } = await supabase
            .from('delivery_trip_crews')
            .insert(crewAssignments)
            .select();

        if (insertError) {
            console.error('[crewService] Error inserting crew assignments:', insertError);

            // Check for unique constraint violation
            if (insertError.code === '23505') {
                throw new Error('One or more staff members are already assigned to this trip with the same role');
            }

            throw insertError;
        }

        // Fetch full details with staff information
        const crewIds = (insertedCrews || []).map(c => c.id);
        return await crewService.getCrewDetailsByIds(crewIds);
    },

    /**
     * Swap a crew member during a trip (Emergency replacement)
     * This is a critical transactional operation:
     * 1. Mark old staff as 'replaced' with end_at timestamp
     * 2. Insert new staff as 'active' with start_at timestamp
     * 
     * @param tripId - UUID of the delivery trip
     * @param oldStaffId - UUID of staff to be replaced
     * @param newStaffId - UUID of replacement staff
     * @param reason - Reason for replacement (e.g., "ป่วยกลางทาง", "ฉุกเฉิน")
     * @returns The new crew assignment record
     */
    swapCrewMember: async (
        tripId: string,
        oldStaffId: string,
        newStaffId: string,
        reason: string
    ): Promise<CrewMemberWithDetails> => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        if (!reason || reason.trim() === '') {
            throw new Error('Reason for crew swap is required');
        }

        // Step 1: Find the current active assignment for the old staff
        const { data: currentAssignment, error: findError } = await supabase
            .from('delivery_trip_crews')
            .select('*')
            .eq('delivery_trip_id', tripId)
            .eq('staff_id', oldStaffId)
            .eq('status', 'active')
            .single();

        if (findError || !currentAssignment) {
            if (findError?.code === 'PGRST116') {
                throw new Error(`No active assignment found for staff ${oldStaffId} in trip ${tripId}`);
            }
            console.error('[crewService] Error finding current assignment:', findError);
            throw findError;
        }

        // Step 2: Validate new staff exists and is available
        const { data: newStaff, error: newStaffError } = await supabase
            .from('service_staff')
            .select('id, name, status')
            .eq('id', newStaffId)
            .single();

        if (newStaffError || !newStaff) {
            throw new Error(`Replacement staff not found: ${newStaffId}`);
        }

        if (newStaff.status === 'inactive') {
            throw new Error(`Cannot assign inactive staff: ${newStaff.name}`);
        }

        // Check if new staff is already assigned to this trip with same role
        const { data: existingAssignment } = await supabase
            .from('delivery_trip_crews')
            .select('id')
            .eq('delivery_trip_id', tripId)
            .eq('staff_id', newStaffId)
            .eq('role', currentAssignment.role)
            .eq('status', 'active')
            .single();

        if (existingAssignment) {
            throw new Error(`Staff ${newStaff.name} is already assigned to this trip as ${currentAssignment.role}`);
        }

        const now = new Date().toISOString();

        // Step 3: Update the old assignment (mark as replaced)
        const { error: updateError } = await supabase
            .from('delivery_trip_crews')
            .update({
                status: 'replaced',
                end_at: now,
                replaced_by_staff_id: newStaffId,
                reason_for_change: reason,
                updated_by: user.id,
            })
            .eq('id', currentAssignment.id);

        if (updateError) {
            console.error('[crewService] Error updating old assignment:', updateError);
            throw new Error('Failed to mark old crew member as replaced');
        }

        // Step 4: Insert new assignment
        const { data: newAssignment, error: insertError } = await supabase
            .from('delivery_trip_crews')
            .insert({
                delivery_trip_id: tripId,
                staff_id: newStaffId,
                role: currentAssignment.role,
                status: 'active',
                start_at: now,
                created_by: user.id,
                updated_by: user.id,
            })
            .select()
            .single();

        if (insertError || !newAssignment) {
            console.error('[crewService] Error inserting new assignment:', insertError);

            // Attempt to rollback the update (best effort)
            await supabase
                .from('delivery_trip_crews')
                .update({
                    status: 'active',
                    end_at: null,
                    replaced_by_staff_id: null,
                    reason_for_change: null,
                })
                .eq('id', currentAssignment.id);

            throw new Error('Failed to create new crew assignment. Changes have been rolled back.');
        }

        // Return the new assignment with full details
        const [newCrewDetails] = await crewService.getCrewDetailsByIds([newAssignment.id]);
        return newCrewDetails;
    },

    /**
     * Remove a crew member from a trip
     * @param tripId - UUID of the delivery trip
     * @param staffId - UUID of staff to remove
     * @param reason - Reason for removal
     */
    removeCrewMember: async (
        tripId: string,
        staffId: string,
        reason: string
    ): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        if (!reason || reason.trim() === '') {
            throw new Error('Reason for removal is required');
        }

        // Find current active assignment
        const { data: currentAssignment, error: findError } = await supabase
            .from('delivery_trip_crews')
            .select('*')
            .eq('delivery_trip_id', tripId)
            .eq('staff_id', staffId)
            .eq('status', 'active')
            .single();

        if (findError || !currentAssignment) {
            throw new Error(`No active assignment found for staff ${staffId} in trip ${tripId}`);
        }

        const now = new Date().toISOString();

        // Update assignment
        const { error: updateError } = await supabase
            .from('delivery_trip_crews')
            .update({
                status: 'removed',
                end_at: now,
                reason_for_change: reason,
                updated_by: user.id,
            })
            .eq('id', currentAssignment.id);

        if (updateError) {
            console.error('[crewService] Error removing crew member:', updateError);
            throw new Error('Failed to remove crew member');
        }
    },

    /**
     * Calculate commission for a completed delivery trip
     * 
     * This function:
     * 1. Fetches trip details (vehicle type, service type)
     * 2. Calculates total delivered items
     * 3. Finds applicable commission rate
     * 4. Distributes commission among crew based on work duration
     * 
     * @param tripId - UUID of the delivery trip
     * @returns Commission calculation breakdown
     */
    calculateCommission: async (tripId: string): Promise<CommissionCalculationResult> => {
        // Step 1: Fetch trip details
        const { data: trip, error: tripError } = await supabase
            .from('delivery_trips')
            .select(`
        id,
        status,
        vehicle_id,
        vehicles (
          id,
          type
        )
      `)
            .eq('id', tripId)
            .single();

        if (tripError || !trip) {
            throw new Error(`Delivery trip not found: ${tripId}`);
        }

        if (trip.status !== 'completed') {
            throw new Error(`Cannot calculate commission for ${trip.status} trip. Trip must be completed.`);
        }

        const vehicleType = (trip.vehicles as any)?.type || 'unknown';

        // Step 2: Calculate total delivered items
        const { data: tripStores, error: storesError } = await supabase
            .from('delivery_trip_stores')
            .select('id, delivery_status')
            .eq('delivery_trip_id', tripId);

        if (storesError) {
            console.error('[crewService] Error fetching trip stores:', storesError);
            throw storesError;
        }

        // Get items from stores thatถือว่า "ส่งแล้ว"
        // ปกติจะใช้ delivery_status = 'delivered'
        // แต่สำหรับทริปเก่า/ทริปที่สถานะร้านยังเป็น pending แต่ทริปถูกปิดเป็น completed แล้ว
        // ให้ถือว่า pending เหล่านั้น "ส่งแล้ว" ด้วย (เหมือน UI ที่แสดงเป็น "ส่งแล้ว")
        const deliveredStoreIds = (tripStores || [])
            .filter((s: any) =>
                s.delivery_status === 'delivered' ||
                (s.delivery_status === 'pending' && trip.status === 'completed')
            )
            .map((s: any) => s.id);

        let totalItemsDelivered = 0;

        if (deliveredStoreIds.length > 0) {
            const { data: items, error: itemsError } = await supabase
                .from('delivery_trip_items')
                .select('quantity')
                .in('delivery_trip_store_id', deliveredStoreIds);

            if (itemsError) {
                console.error('[crewService] Error fetching trip items:', itemsError);
                throw itemsError;
            }

            totalItemsDelivered = (items || []).reduce(
                (sum, item) => sum + Number(item.quantity),
                0
            );
        }

        // Step 3: Find applicable commission rate
        // Priority: vehicle_type + service_type > vehicle_type only > service_type only > default
        const today = new Date().toISOString().split('T')[0];

        const { data: rates, error: ratesError } = await supabase
            .from('commission_rates')
            .select('*')
            .eq('is_active', true)
            .lte('effective_from', today)
            .or(`effective_until.is.null,effective_until.gte.${today}`)
            .order('vehicle_type', { ascending: false, nullsFirst: false })
            .order('service_type', { ascending: false, nullsFirst: false });

        if (ratesError) {
            console.error('[crewService] Error fetching commission rates:', ratesError);
            throw ratesError;
        }

        // Find best matching rate
        let selectedRate: CommissionRate | null = null;
        const serviceType = 'standard'; // TODO: Get from trip or make configurable

        if (rates && rates.length > 0) {
            // Try to find exact match (vehicle_type + service_type)
            selectedRate = rates.find(
                r => r.vehicle_type === vehicleType && r.service_type === serviceType
            ) || null;

            // Fallback to vehicle_type only
            if (!selectedRate) {
                selectedRate = rates.find(
                    r => r.vehicle_type === vehicleType && !r.service_type
                ) || null;
            }

            // Fallback to service_type only
            if (!selectedRate) {
                selectedRate = rates.find(
                    r => !r.vehicle_type && r.service_type === serviceType
                ) || null;
            }

            // Fallback to default rate (no vehicle_type, no service_type)
            if (!selectedRate) {
                selectedRate = rates.find(r => !r.vehicle_type && !r.service_type) || null;
            }
        }

        if (!selectedRate) {
            throw new Error(
                `No commission rate found for vehicle type: ${vehicleType}, service type: ${serviceType}`
            );
        }

        const ratePerUnit = Number(selectedRate.rate_per_unit);
        const totalCommission = totalItemsDelivered * ratePerUnit;

        // Step 4: Get crew members and calculate work duration
        const { data: crewMembers, error: crewError } = await supabase
            .from('delivery_trip_crews')
            .select(`
        id,
        staff_id,
        role,
        start_at,
        end_at,
        service_staff:service_staff!delivery_trip_crews_staff_id_fkey (
          id,
          name
        )
      `)
            .eq('delivery_trip_id', tripId)
            .in('status', ['active', 'replaced']); // Include both active and replaced crew

        if (crewError) {
            console.error('[crewService] Error fetching crew members:', crewError);
            throw crewError;
        }

        if (!crewMembers || crewMembers.length === 0) {
            throw new Error('No crew members found for this trip');
        }

        // Calculate work duration for each crew member
        const tripEndTime = new Date(); // Use current time or trip completion time
        const crewWithDuration = crewMembers.map(crew => {
            const startTime = new Date(crew.start_at);
            const endTime = crew.end_at ? new Date(crew.end_at) : tripEndTime;
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            return {
                staffId: crew.staff_id,
                staffName: (crew.service_staff as any)?.name || 'Unknown',
                role: crew.role,
                workDurationHours: Math.max(0, durationHours),
            };
        });

        // Calculate total work hours
        const totalWorkHours = crewWithDuration.reduce(
            (sum, crew) => sum + crew.workDurationHours,
            0
        );

        // Distribute commission based on work percentage
        const crewCommissions = crewWithDuration.map(crew => {
            const workPercentage = totalWorkHours > 0
                ? (crew.workDurationHours / totalWorkHours) * 100
                : 100 / crewWithDuration.length; // Equal split if no duration data

            const commissionAmount = (totalCommission * workPercentage) / 100;

            return {
                ...crew,
                workPercentage: Math.round(workPercentage * 100) / 100,
                commissionAmount: Math.round(commissionAmount * 100) / 100,
            };
        });

        return {
            tripId,
            vehicleType,
            serviceType,
            totalItemsDelivered,
            rateApplied: ratePerUnit,
            totalCommission: Math.round(totalCommission * 100) / 100,
            crewMembers: crewCommissions,
        };
    },

    /**
     * Save commission calculation results to commission_logs table
     * This creates an immutable audit record
     * 
     * @param calculation - Commission calculation result
     * @returns Array of created commission log records
     */
    saveCommissionLogs: async (
        calculation: CommissionCalculationResult
    ): Promise<CommissionLog[]> => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        // Delete existing logs for this trip first to allow re-calculation
        const { error: deleteError } = await supabase
            .from('commission_logs')
            .delete()
            .eq('delivery_trip_id', calculation.tripId);

        if (deleteError) {
            console.error('[crewService] Error deleting existing commission logs:', deleteError);
            throw deleteError;
        }

        // Create commission log entries for each crew member
        const logEntries = calculation.crewMembers.map(crew => ({
            delivery_trip_id: calculation.tripId,
            staff_id: crew.staffId,
            total_items_delivered: calculation.totalItemsDelivered,
            rate_applied: calculation.rateApplied,
            commission_amount: calculation.totalCommission,
            work_percentage: crew.workPercentage,
            actual_commission: crew.commissionAmount,
            calculated_by: user.id,
            notes: `Auto-calculated for ${calculation.vehicleType} - ${calculation.serviceType}`,
        }));

        const { data: logs, error: insertError } = await supabase
            .from('commission_logs')
            .insert(logEntries)
            .select();

        if (insertError) {
            console.error('[crewService] Error saving commission logs:', insertError);
            throw insertError;
        }

        return logs || [];
    },

    /**
     * Get crew members for a trip with full details
     * @param tripId - UUID of the delivery trip
     * @param activeOnly - If true, only return active crew members
     * @returns Array of crew members with staff details
     */
    getCrewByTripId: async (
        tripId: string,
        activeOnly: boolean = false
    ): Promise<CrewMemberWithDetails[]> => {
        let query = supabase
            .from('delivery_trip_crews')
            .select(`
        *,
        service_staff!delivery_trip_crews_staff_id_fkey (
          id,
          name,
          employee_code,
          status
        ),
        replaced_by:service_staff!delivery_trip_crews_replaced_by_staff_id_fkey (
          id,
          name
        )
      `)
            .eq('delivery_trip_id', tripId)
            .order('start_at', { ascending: true });

        if (activeOnly) {
            query = query.eq('status', 'active');
        }

        const { data, error } = await query;

        if (error) {
            console.error('[crewService] Error fetching crew:', error);
            throw error;
        }

        return (data || []).map(crew => ({
            ...crew,
            staff: (crew.service_staff as any) || undefined,
            replaced_by: (crew.replaced_by as any) || null,
        })) as CrewMemberWithDetails[];
    },

    /**
     * Helper function to get crew details by IDs
     * @param crewIds - Array of crew assignment IDs
     * @returns Array of crew members with full details
     */
    getCrewDetailsByIds: async (crewIds: string[]): Promise<CrewMemberWithDetails[]> => {
        const { data, error } = await supabase
            .from('delivery_trip_crews')
            .select(`
        *,
        service_staff!delivery_trip_crews_staff_id_fkey (
          id,
          name,
          employee_code,
          status
        ),
        replaced_by:service_staff!delivery_trip_crews_replaced_by_staff_id_fkey (
          id,
          name
        )
      `)
            .in('id', crewIds);

        if (error) {
            console.error('[crewService] Error fetching crew details:', error);
            throw error;
        }

        return (data || []).map(crew => ({
            ...crew,
            staff: (crew.service_staff as any) || undefined,
            replaced_by: (crew.replaced_by as any) || null,
        })) as CrewMemberWithDetails[];
    },

    /**
     * Get commission logs for a trip
     * @param tripId - UUID of the delivery trip
     * @returns Array of commission log records
     */
    getCommissionLogsByTripId: async (tripId: string): Promise<CommissionLog[]> => {
        const { data, error } = await supabase
            .from('commission_logs')
            .select('*')
            .eq('delivery_trip_id', tripId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[crewService] Error fetching commission logs:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Get trips that are completed but don't have commission logs yet
     * @param limit - Number of records to return
     * @returns Array of trips pending commission calculation
     */
    getPendingCommissionTrips: async (limit: number = 20): Promise<any[]> => {
        // 1) Get recent completed trips
        const { data: trips, error: tripsError } = await supabase
            .from('delivery_trips')
            .select(`
                id, 
                trip_number, 
                status, 
                planned_date,
                vehicles (
                    type,
                    plate
                )
            `)
            .eq('status', 'completed')
            .order('planned_date', { ascending: false })
            .limit(100);

        if (tripsError) {
            console.error('[crewService] Error fetching completed trips:', tripsError);
            throw tripsError;
        }

        if (!trips || trips.length === 0) return [];

        const tripIds = trips.map(t => t.id);

        // 2) Find which ones already have logs
        const { data: existingLogs, error: logsError } = await supabase
            .from('commission_logs')
            .select('delivery_trip_id')
            .in('delivery_trip_id', tripIds);

        if (logsError) {
            console.error('[crewService] Error fetching existing commission logs:', logsError);
            throw logsError;
        }

        const tripsWithLogs = new Set(existingLogs?.map(l => l.delivery_trip_id));
        
        // 3) Find which ones have crew members (Only those with crew can be calculated)
        const { data: tripsWithCrew, error: crewError } = await supabase
            .from('delivery_trip_crews')
            .select('delivery_trip_id')
            .in('delivery_trip_id', tripIds)
            .in('status', ['active', 'replaced']);

        if (crewError) {
            console.error('[crewService] Error fetching trips with crew:', crewError);
            throw crewError;
        }

        const tripsWithCrewSet = new Set(tripsWithCrew?.map(c => c.delivery_trip_id));

        // 4) Filter: No logs AND Has crew
        return trips
            .filter(t => !tripsWithLogs.has(t.id) && tripsWithCrewSet.has(t.id))
            .slice(0, limit);
    },

    /**
     * Trigger commission calculation via Edge Function
     * This is safer as it runs with service role and can bypass RLS issues
     */
    calculateCommissionViaFunction: async (tripId: string): Promise<{ success: boolean; reason?: string; message?: string }> => {
        const { data, error } = await supabase.functions.invoke('auto-commission-worker', {
            body: { trip_id: tripId, source: 'manual_recalculate' }
        });

        if (error) {
            console.error('[crewService] Error invoking auto-commission-worker:', error);
            throw error;
        }

        // Return full response object including reason and message for better error handling
        return {
            success: data?.success || false,
            reason: data?.reason,
            message: data?.message || data?.error
        };
    },
};
