// Store Service - CRUD operations for stores/customers
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { searchWithMultipleFields } from '../utils/searchUtils';

export type Store = Database['public']['Tables']['stores']['Row'];
type StoreInsert = Database['public']['Tables']['stores']['Insert'];
type StoreUpdate = Database['public']['Tables']['stores']['Update'];

export interface StoreWithRelations extends Store {
  // Can be extended with relations if needed
}

export interface StoreFilters {
  search?: string;
  is_active?: boolean;
}

export const storeService = {
  // Get all stores
  getAll: async (filters?: StoreFilters): Promise<Store[]> => {
    // If search is provided, use searchUtils for consistent search logic
    if (filters?.search) {
      const additionalFilters: Record<string, any> = {};
      if (filters?.is_active !== undefined) {
        additionalFilters.is_active = filters.is_active;
      }
      
      return await searchWithMultipleFields<Store>(
        supabase,
        'stores',
        filters.search,
        ['customer_code', 'customer_name'],
        additionalFilters,
        100
      );
    }
    
    // No search - use normal query
    let query = supabase
      .from('stores')
      .select('*')
      .order('customer_name', { ascending: true });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[storeService] Error fetching stores:', error);
      throw error;
    }

    return data || [];
  },

  // Get store by ID
  getById: async (id: string): Promise<Store | null> => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[storeService] Error fetching store:', error);
      throw error;
    }

    return data;
  },

  // Get store by customer code
  getByCustomerCode: async (customerCode: string): Promise<Store | null> => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('customer_code', customerCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[storeService] Error fetching store by code:', error);
      throw error;
    }

    return data;
  },

  // Create store
  create: async (data: Omit<StoreInsert, 'id' | 'created_at' | 'updated_at'>): Promise<Store> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const storeData: StoreInsert = {
      ...data,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data: result, error } = await supabase
      .from('stores')
      .insert(storeData)
      .select()
      .single();

    if (error) {
      console.error('[storeService] Error creating store:', error);
      throw error;
    }

    return result;
  },

  // Update store
  update: async (id: string, data: Omit<StoreUpdate, 'id' | 'created_at' | 'updated_at'>): Promise<Store> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const updateData: StoreUpdate = {
      ...data,
      updated_by: user.id,
    };

    const { data: result, error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[storeService] Error updating store:', error);
      throw error;
    }

    return result;
  },

  // Delete store
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[storeService] Error deleting store:', error);
      throw error;
    }
  },

  // Bulk import stores
  // Import one by one to handle duplicates gracefully
  bulkImport: async (stores: Array<Omit<StoreInsert, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>): Promise<Store[]> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const imported: Store[] = [];
    const errors: string[] = [];

    // Import one by one to handle duplicates
    for (const store of stores) {
      try {
        const storeData: StoreInsert = {
          ...store,
          created_by: user.id,
          updated_by: user.id,
        };

        const { data, error } = await supabase
          .from('stores')
          .insert(storeData)
          .select()
          .single();

        if (error) {
          // Check if it's a duplicate key error
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
            // Skip duplicate - this is expected for stores that already exist
            console.log(`[storeService] Skipping duplicate store: ${store.customer_code}`);
            continue;
          }
          // Other errors - log but continue
          console.error(`[storeService] Error importing store ${store.customer_code}:`, error);
          errors.push(`Customer Code "${store.customer_code}": ${error.message}`);
          continue;
        }

        if (data) {
          imported.push(data);
        }
      } catch (err: any) {
        console.error(`[storeService] Error importing store ${store.customer_code}:`, err);
        errors.push(`Customer Code "${store.customer_code}": ${err.message || 'Unknown error'}`);
      }
    }

    // If some stores were imported successfully, return them
    // Even if there were errors, we still return the successfully imported ones
    if (imported.length === 0 && errors.length > 0) {
      throw new Error(`ไม่สามารถ import ร้านค้าได้: ${errors.join('; ')}`);
    }

    return imported;
  },
};

