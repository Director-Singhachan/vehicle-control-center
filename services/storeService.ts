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
  branch?: string;
  limit?: number;
  offset?: number;
}

export interface StoreListResult {
  data: Store[];
  totalCount: number;
}

export const storeService = {
  // Get all stores with pagination support
  getAll: async (filters?: StoreFilters): Promise<StoreListResult> => {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    // If search is provided, use searchUtils for consistent search logic
    if (filters?.search) {
      const additionalFilters: Record<string, any> = {};
      if (filters?.is_active !== undefined) {
        additionalFilters.is_active = filters.is_active;
      }
      if (filters?.branch) {
        additionalFilters.branch = filters.branch;
      }
      
      // For search, we need to get total count separately
      const searchResults = await searchWithMultipleFields<Store>(
        supabase,
        'stores',
        filters.search,
        ['customer_code', 'customer_name'],
        additionalFilters,
        10000 // Large limit to get all matches for counting
      );

      // Apply pagination to search results
      const paginatedResults = searchResults.slice(offset, offset + limit);
      
      return {
        data: paginatedResults,
        totalCount: searchResults.length,
      };
    }
    
    // No search - use normal query with count
    let query = supabase
      .from('stores')
      .select('*', { count: 'exact' })
      .order('customer_name', { ascending: true });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.branch) {
      query = query.eq('branch', filters.branch);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[storeService] Error fetching stores:', error);
      throw error;
    }

    return {
      data: data || [],
      totalCount: count || 0,
    };
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { count: orderCount, error: orderCountError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', id);

    if (orderCountError) {
      console.error('[storeService] Error counting orders for store:', orderCountError);
      throw orderCountError;
    }

    if (orderCount != null && orderCount > 0) {
      throw new Error(
        `ไม่สามารถลบลูกค้าได้ เนื่องจากมีออเดอร์ผูกอยู่ ${orderCount} รายการ — ให้ใช้การปิดใช้งาน (is_active) แทน หรือจัดการออเดอร์ก่อน`
      );
    }

    // Trip stops reference stores with ON DELETE RESTRICT; remove stops first
    // (delivery_trip_items CASCADE from delivery_trip_stores per schema)
    const { error: tripStoresError } = await supabase
      .from('delivery_trip_stores')
      .delete()
      .eq('store_id', id);

    if (tripStoresError) {
      console.error('[storeService] Error removing delivery_trip_stores for store:', tripStoresError);
      throw tripStoresError;
    }

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[storeService] Error deleting store:', error);
      if (error.code === '23503') {
        throw new Error(
          'ไม่สามารถลบลูกค้าได้ เนื่องจากยังมีข้อมูลอื่นในระบบอ้างอิงอยู่ — ติดต่อผู้ดูแลระบบหรือใช้การปิดใช้งานแทน'
        );
      }
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

  // Get the latest update timestamp from the stores table
  getLastUpdate: async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('stores')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[storeService] Error fetching last update:', error);
      throw error;
    }

    return data?.updated_at || null;
  },
};

