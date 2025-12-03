// Custom hooks for crew management
import { useState, useEffect } from 'react';
import { crewService, type CrewMemberWithDetails, type CommissionCalculationResult } from '../services/crewService';
import type { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];
type CommissionRate = Database['public']['Tables']['commission_rates']['Row'];
type CommissionLog = Database['public']['Tables']['commission_logs']['Row'];

/**
 * Hook to fetch crew members for a delivery trip
 * @param tripId - UUID of the delivery trip
 * @param activeOnly - If true, only fetch active crew members
 */
export function useCrewByTrip(tripId: string | null, activeOnly: boolean = false) {
    const [crew, setCrew] = useState<CrewMemberWithDetails[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tripId) {
            setCrew([]);
            return;
        }

        let cancelled = false;

        const fetchCrew = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await crewService.getCrewByTripId(tripId, activeOnly);
                if (!cancelled) {
                    setCrew(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err : new Error('Failed to fetch crew'));
                    console.error('[useCrewByTrip] Error:', err);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchCrew();

        return () => {
            cancelled = true;
        };
    }, [tripId, activeOnly]);

    const refresh = async () => {
        if (!tripId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await crewService.getCrewByTripId(tripId, activeOnly);
            setCrew(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to refresh crew'));
            console.error('[useCrewByTrip] Refresh error:', err);
        } finally {
            setLoading(false);
        }
    };

    return { crew, loading, error, refresh };
}

/**
 * Hook to fetch commission logs for a delivery trip
 * @param tripId - UUID of the delivery trip
 */
export function useCommissionLogs(tripId: string | null) {
    const [logs, setLogs] = useState<CommissionLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tripId) {
            setLogs([]);
            return;
        }

        let cancelled = false;

        const fetchLogs = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await crewService.getCommissionLogsByTripId(tripId);
                if (!cancelled) {
                    setLogs(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err : new Error('Failed to fetch commission logs'));
                    console.error('[useCommissionLogs] Error:', err);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchLogs();

        return () => {
            cancelled = true;
        };
    }, [tripId]);

    const refresh = async () => {
        if (!tripId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await crewService.getCommissionLogsByTripId(tripId);
            setLogs(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to refresh commission logs'));
            console.error('[useCommissionLogs] Refresh error:', err);
        } finally {
            setLoading(false);
        }
    };

    return { logs, loading, error, refresh };
}

/**
 * Hook for crew management operations
 * Provides functions for assigning, swapping, and managing crew
 */
export function useCrewManagement() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const assignCrew = async (
        tripId: string,
        staffIds: string[],
        role: 'driver' | 'helper'
    ): Promise<CrewMemberWithDetails[] | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await crewService.assignCrewToTrip(tripId, staffIds, role);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to assign crew');
            setError(error);
            console.error('[useCrewManagement] Assign error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const swapCrew = async (
        tripId: string,
        oldStaffId: string,
        newStaffId: string,
        reason: string
    ): Promise<CrewMemberWithDetails | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await crewService.swapCrewMember(tripId, oldStaffId, newStaffId, reason);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to swap crew member');
            setError(error);
            console.error('[useCrewManagement] Swap error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        assignCrew,
        swapCrew,
        loading,
        error,
    };
}

/**
 * Hook for commission calculation
 * Provides functions to calculate and save commissions
 */
export function useCommissionCalculation() {
    const [calculation, setCalculation] = useState<CommissionCalculationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const calculateCommission = async (tripId: string): Promise<CommissionCalculationResult | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await crewService.calculateCommission(tripId);
            setCalculation(result);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to calculate commission');
            setError(error);
            setCalculation(null);
            console.error('[useCommissionCalculation] Calculate error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const saveCommission = async (
        calculationResult: CommissionCalculationResult
    ): Promise<CommissionLog[] | null> => {
        setLoading(true);
        setError(null);

        try {
            const logs = await crewService.saveCommissionLogs(calculationResult);
            return logs;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to save commission');
            setError(error);
            console.error('[useCommissionCalculation] Save error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const calculateAndSave = async (tripId: string): Promise<CommissionLog[] | null> => {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Calculate
            const result = await crewService.calculateCommission(tripId);
            setCalculation(result);

            // Step 2: Save
            const logs = await crewService.saveCommissionLogs(result);
            return logs;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to calculate and save commission');
            setError(error);
            setCalculation(null);
            console.error('[useCommissionCalculation] Calculate and save error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        calculation,
        calculateCommission,
        saveCommission,
        calculateAndSave,
        loading,
        error,
    };
}
