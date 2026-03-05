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
