// Product Service - CRUD operations for products
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export interface ProductWithRelations extends Product {
  // Can be extended with relations if needed
}

export interface ProductFilters {
  search?: string;
  category?: string;
  is_active?: boolean;
}

export const productService = {
  // Get all products
  getAll: async (filters?: ProductFilters): Promise<Product[]> => {
    let query = supabase
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('product_name', { ascending: true });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    // If search is provided, use separate queries to avoid PostgREST parsing errors
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        
        // Build base queries with is_active and category filters
        let codeQuery = supabase
          .from('products')
          .select('*')
          .ilike('product_code', searchPattern);
        
        let nameQuery = supabase
          .from('products')
          .select('*')
          .ilike('product_name', searchPattern);
        
        let categoryQuery = supabase
          .from('products')
          .select('*')
          .ilike('category', searchPattern);
        
        // Apply is_active filter if provided
        if (filters?.is_active !== undefined) {
          codeQuery = codeQuery.eq('is_active', filters.is_active);
          nameQuery = nameQuery.eq('is_active', filters.is_active);
          categoryQuery = categoryQuery.eq('is_active', filters.is_active);
        }
        
        // Apply category filter if provided
        if (filters?.category) {
          codeQuery = codeQuery.eq('category', filters.category);
          nameQuery = nameQuery.eq('category', filters.category);
          categoryQuery = categoryQuery.eq('category', filters.category);
        }
        
        // Execute all queries in parallel
        const [codeResult, nameResult, categoryResult] = await Promise.all([
          codeQuery,
          nameQuery,
          categoryQuery
        ]);
        
        if (codeResult.error) {
          console.error('[productService] Error fetching products by code:', codeResult.error);
          throw codeResult.error;
        }
        
        if (nameResult.error) {
          console.error('[productService] Error fetching products by name:', nameResult.error);
          throw nameResult.error;
        }
        
        if (categoryResult.error) {
          console.error('[productService] Error fetching products by category:', categoryResult.error);
          throw categoryResult.error;
        }
        
        // Combine results and remove duplicates
        const codeProducts = codeResult.data || [];
        const nameProducts = nameResult.data || [];
        const categoryProducts = categoryResult.data || [];
        const combinedProducts = [...codeProducts, ...nameProducts, ...categoryProducts];
        
        // Remove duplicates by id
        const uniqueProducts = combinedProducts.filter((product, index, self) =>
          index === self.findIndex(p => p.id === product.id)
        );
        
        // Sort and limit
        uniqueProducts.sort((a, b) => {
          // Sort by category first, then product_name
          if (a.category !== b.category) {
            return (a.category || '').localeCompare(b.category || '');
          }
          return (a.product_name || '').localeCompare(b.product_name || '');
        });
        const limitedProducts = uniqueProducts.slice(0, 100);
        
        return limitedProducts;
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[productService] Error fetching products:', error);
      throw error;
    }

    return data || [];
  },

  // Get products by category
  getByCategory: async (category: string): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('product_name', { ascending: true });

    if (error) {
      console.error('[productService] Error fetching products by category:', error);
      throw error;
    }

    return data || [];
  },

  // Get all categories
  getCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true);

    if (error) {
      console.error('[productService] Error fetching categories:', error);
      throw error;
    }

    const categories = [...new Set((data || []).map(p => p.category))];
    return categories.sort();
  },

  // Get product by ID
  getById: async (id: string): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[productService] Error fetching product:', error);
      throw error;
    }

    return data;
  },

  // Get product by product code
  getByProductCode: async (productCode: string): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[productService] Error fetching product by code:', error);
      throw error;
    }

    return data;
  },

  // Create product
  create: async (data: Omit<ProductInsert, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const productData: ProductInsert = {
      ...data,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data: result, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      console.error('[productService] Error creating product:', error);
      throw error;
    }

    return result;
  },

  // Update product
  update: async (id: string, data: Omit<ProductUpdate, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const updateData: ProductUpdate = {
      ...data,
      updated_by: user.id,
    };

    const { data: result, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[productService] Error updating product:', error);
      throw error;
    }

    return result;
  },

  // Delete product
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[productService] Error deleting product:', error);
      throw error;
    }
  },

  // Bulk import products
  // Import one by one to handle duplicates gracefully
  bulkImport: async (products: Array<Omit<ProductInsert, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>): Promise<Product[]> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const imported: Product[] = [];
    const errors: string[] = [];

    // Import one by one to handle duplicates
    for (const product of products) {
      try {
        const productData: ProductInsert = {
          ...product,
          created_by: user.id,
          updated_by: user.id,
        };

        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) {
          // Check if it's a duplicate key error
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
            // Skip duplicate - this is expected for products that already exist
            console.log(`[productService] Skipping duplicate product: ${product.product_code} (${product.unit})`);
            continue;
          }
          // Other errors - log but continue
          console.error(`[productService] Error importing product ${product.product_code}:`, error);
          errors.push(`รหัสสินค้า "${product.product_code}" หน่วย "${product.unit}": ${error.message}`);
          continue;
        }

        if (data) {
          imported.push(data);
        }
      } catch (err: any) {
        console.error(`[productService] Error importing product ${product.product_code}:`, err);
        errors.push(`รหัสสินค้า "${product.product_code}" หน่วย "${product.unit}": ${err.message || 'Unknown error'}`);
      }
    }

    // If some products were imported successfully, return them
    // Even if there were errors, we still return the successfully imported ones
    if (imported.length === 0 && errors.length > 0) {
      throw new Error(`ไม่สามารถ import สินค้าได้: ${errors.join('; ')}`);
    }

    return imported;
  },
};

