import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];

export const serviceStaffService = {
    // Get all active service staff
    getAllActive: async (): Promise<ServiceStaff[]> => {
        const { data, error } = await supabase
            .from('service_staff')
            .select('*')
            .eq('status', 'active')
            .order('name', { ascending: true });

        if (error) {
            console.error('[serviceStaffService] Error fetching active staff:', error);
            throw error;
        }

        return data || [];
    },

    // Get all service staff (including inactive)
    getAll: async (): Promise<ServiceStaff[]> => {
        const { data, error } = await supabase
            .from('service_staff')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('[serviceStaffService] Error fetching all staff:', error);
            throw error;
        }

        return data || [];
    },

    // Get staff by ID
    getById: async (id: string): Promise<ServiceStaff | null> => {
        const { data, error } = await supabase
            .from('service_staff')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[serviceStaffService] Error fetching staff by id:', error);
            throw error;
        }

        return data;
    },

    // Get all active service staff with branch + staffRole (joined from profiles via user_id)
    getAllActiveWithBranch: async (): Promise<(ServiceStaff & { branch: string | null; staffRole: string | null })[]> => {
        const { data: staffData, error: staffErr } = await supabase
            .from('service_staff')
            .select('*')
            .eq('status', 'active')
            .order('name', { ascending: true });

        if (staffErr) {
            console.error('[serviceStaffService] Error fetching active staff:', staffErr);
            throw staffErr;
        }

        const list = staffData || [];
        const userIds = list.flatMap(s => (s.user_id ? [s.user_id] : []));
        const branchMap: Record<string, string | null> = {};
        const roleMap: Record<string, string | null> = {};

        if (userIds.length > 0) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, branch, role')
                .in('id', userIds);
            (profileData || []).forEach(p => {
                branchMap[p.id] = p.branch;
                roleMap[p.id] = p.role;
            });
        }

        return list.map(s => ({
            ...s,
            branch: s.user_id ? (branchMap[s.user_id] ?? null) : null,
            staffRole: s.user_id ? (roleMap[s.user_id] ?? null) : null,
        }));
    },

    /** รายชื่อพนักงานบริการ/คนขับที่ยังไม่มีบัญชี (สำหรับผูกบัญชีกับรายชื่อเดิม) */
    getUnlinked: async (): Promise<ServiceStaff[]> => {
        const { data, error } = await supabase
            .from('service_staff')
            .select('*')
            .is('user_id', null)
            .order('name', { ascending: true });

        if (error) {
            console.error('[serviceStaffService] Error fetching unlinked staff:', error);
            throw error;
        }
        return data || [];
    },
};
