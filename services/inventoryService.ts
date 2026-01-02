import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type Warehouse = Database['public']['Tables']['warehouses']['Row'];
type Inventory = Database['public']['Tables']['inventory']['Row'];
type InventoryWithDetails = Database['public']['Views']['inventory_with_details']['Row'];
type InventoryTransaction = Database['public']['Tables']['inventory_transactions']['Row'];
type TripItem = Database['public']['Tables']['trip_items']['Row'];

// ========================================
// Product Categories
// ========================================

export const productCategoryService = {
  /**
   * ดึงหมวดหมู่สินค้าทั้งหมด
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as ProductCategory[];
    } catch (err) {
      // ถ้าไม่มีตาราง product_categories (404) หรือ error อื่น ให้ fallback ไปดึงหมวดหมู่จาก products (distinct)
      console.warn('[productCategoryService.getAll] fallback to products distinct categories', err);
      const { data: productCats, error: productError } = await supabase
        .from('products')
        .select('category')
        .or('is_active.is.null,is_active.eq.true')
        .order('category');

      if (productError) {
        console.error('[productCategoryService.getAll] fallback products error', productError);
        return [];
      }

      const unique = Array.from(
        new Set((productCats || []).map((p: any) => p.category).filter(Boolean))
      );

      return unique.map((cat) => ({
        // ใช้ชื่อหมวดหมู่เป็น id ชั่วคราวเพื่อใช้กรองใน UI
        id: cat,
        name: cat,
        is_active: true,
        created_at: null,
        updated_at: null,
      })) as unknown as ProductCategory[];
    }
  },

  /**
   * ดึงหมวดหมู่ตาม ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ProductCategory;
  },

  /**
   * สร้างหมวดหมู่ใหม่
   */
  async create(category: Omit<ProductCategory, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('product_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data as ProductCategory;
  },

  /**
   * อัพเดทหมวดหมู่
   */
  async update(id: string, updates: Partial<ProductCategory>) {
    const { data, error } = await supabase
      .from('product_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ProductCategory;
  },

  /**
   * ลบหมวดหมู่ (soft delete)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('product_categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// ========================================
// Products
// ========================================

export const productService = {
  /**
   * ดึงสินค้าทั้งหมดพร้อมข้อมูลหมวดหมู่
   */
  async getAll() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      // บางข้อมูลเก่าอาจไม่มี is_active ให้ดึงทั้งที่เป็น true หรือค่าว่าง
      .or('is_active.is.null,is_active.eq.true')
      .order('product_name');

    if (error) throw error;
    return data;
  },

  /**
   * ดึงสินค้าตาม ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ค้นหาสินค้าตามชื่อหรือ SKU
   */
  async search(query: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(20);

    if (error) throw error;
    return data;
  },

  /**
   * ดึงสินค้าตามหมวดหมู่
   */
  async getByCategory(categoryId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * สร้างสินค้าใหม่
   */
  async create(product: ProductInsert) {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * อัพเดทสินค้า
   */
  async update(id: string, updates: ProductUpdate) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ลบสินค้า (soft delete)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// ========================================
// Warehouses
// ========================================

export const warehouseService = {
  /**
   * ดึงคลังสินค้าทั้งหมด
   */
  async getAll() {
    const { data, error } = await supabase
      .from('warehouses')
      .select(`
        *,
        manager:profiles(id, full_name, email)
      `)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * ดึงคลังตาม ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('warehouses')
      .select(`
        *,
        manager:profiles(id, full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ดึงคลังตามประเภท
   */
  async getByType(type: string) {
    const { data, error } = await supabase
      .from('warehouses')
      .select(`
        *,
        manager:profiles(id, full_name, email)
      `)
      .eq('type', type)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * สร้างคลังใหม่
   */
  async create(warehouse: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('warehouses')
      .insert(warehouse)
      .select()
      .single();

    if (error) throw error;
    return data as Warehouse;
  },

  /**
   * อัพเดทคลัง
   */
  async update(id: string, updates: Partial<Warehouse>) {
    const { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Warehouse;
  },

  /**
   * ลบคลัง (soft delete)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('warehouses')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// ========================================
// Inventory
// ========================================

export const inventoryService = {
  /**
   * ดึงสต็อกทั้งหมดพร้อมรายละเอียด
   */
  async getAll() {
    const { data, error } = await supabase
      .from('inventory_with_details')
      .select('*')
      .order('warehouse_name')
      .order('product_name');

    if (error) throw error;
    return data as InventoryWithDetails[];
  },

  /**
   * ดึงสต็อกตามคลัง
   */
  async getByWarehouse(warehouseId: string) {
    const { data, error } = await supabase
      .from('inventory_with_details')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('product_name');

    if (error) throw error;
    return data as InventoryWithDetails[];
  },

  /**
   * ดึงสต็อกตามสินค้า (ทุกคลัง)
   */
  async getByProduct(productId: string) {
    const { data, error } = await supabase
      .from('inventory_with_details')
      .select('*')
      .eq('product_id', productId)
      .order('warehouse_name');

    if (error) throw error;
    return data as InventoryWithDetails[];
  },

  /**
   * ดึงสินค้าที่สต็อกต่ำ
   */
  async getLowStock() {
    const { data, error } = await supabase
      .from('inventory_with_details')
      .select('*')
      .in('stock_status', ['low_stock', 'out_of_stock'])
      .order('stock_status')
      .order('available_quantity');

    if (error) throw error;
    return data as InventoryWithDetails[];
  },

  /**
   * อัพเดทจำนวนสต็อก
   */
  async updateQuantity(
    warehouseId: string,
    productId: string,
    quantity: number,
    userId: string
  ) {
    // ตรวจสอบว่ามี inventory record อยู่แล้วหรือไม่
    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .single();

    if (existing) {
      // อัพเดท (ไม่แตะ available_quantity หากเป็น generated/trigger)
      const { data, error } = await supabase
        .from('inventory')
        .update({
          quantity,
          updated_by: userId,
          last_updated_at: new Date().toISOString(),
        })
        .eq('warehouse_id', warehouseId)
        .eq('product_id', productId)
        .select()
        .single();

      if (error) throw error;
      return data as Inventory;
    } else {
      // สร้างใหม่ (ไม่กำหนด available_quantity หากคอลัมน์เป็น generated/trigger)
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          warehouse_id: warehouseId,
          product_id: productId,
          quantity,
          reserved_quantity: 0,
          updated_by: userId,
          last_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Inventory;
    }
  },

  /**
   * ปรับปรุงสต็อก (เพิ่ม/ลด)
   */
  async adjustStock(
    warehouseId: string,
    productId: string,
    adjustment: number,
    userId: string,
    note?: string
  ) {
    // ดึงข้อมูลสต็อกปัจจุบัน
    const { data: current } = await supabase
      .from('inventory')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .single();

    const currentQty = current?.quantity || 0;
    const newQty = currentQty + adjustment;

    if (newQty < 0) {
      throw new Error('จำนวนสต็อกไม่เพียงพอ');
    }

    // อัพเดทสต็อก
    await this.updateQuantity(warehouseId, productId, newQty, userId);

    // บันทึกประวัติ
    await this.recordTransaction({
      warehouse_id: warehouseId,
      product_id: productId,
      transaction_type: adjustment > 0 ? 'in' : 'out',
      quantity: Math.abs(adjustment),
      reference_type: 'adjust',
      note,
      created_by: userId,
    });
  },

  /**
   * จองสต็อก (สำหรับทริป)
   */
  async reserveStock(
    warehouseId: string,
    productId: string,
    quantity: number
  ) {
    const { data: current } = await supabase
      .from('inventory')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .single();

    if (!current || current.available_quantity < quantity) {
      throw new Error('สต็อกไม่เพียงพอสำหรับการจอง');
    }

    const { data, error } = await supabase
      .from('inventory')
      .update({
        reserved_quantity: current.reserved_quantity + quantity,
        last_updated_at: new Date().toISOString(),
      })
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) throw error;
    return data as Inventory;
  },

  /**
   * ยกเลิกการจองสต็อก
   */
  async unreserveStock(
    warehouseId: string,
    productId: string,
    quantity: number
  ) {
    const { data: current } = await supabase
      .from('inventory')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .single();

    if (!current) return;

    const { data, error } = await supabase
      .from('inventory')
      .update({
        reserved_quantity: Math.max(0, current.reserved_quantity - quantity),
        last_updated_at: new Date().toISOString(),
      })
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) throw error;
    return data as Inventory;
  },

  /**
   * บันทึกประวัติการเคลื่อนไหวสต็อก
   */
  async recordTransaction(
    transaction: Omit<InventoryTransaction, 'id' | 'created_at'>
  ) {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;
    return data as InventoryTransaction;
  },

  /**
   * ดึงประวัติการเคลื่อนไหวสต็อก
   */
  async getTransactions(filters?: {
    warehouseId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    let query = supabase
      .from('inventory_transactions')
      .select(`
        *,
        warehouse:warehouses(code, name),
        product:products(sku, name, unit),
        creator:profiles(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (filters?.warehouseId) {
      query = query.eq('warehouse_id', filters.warehouseId);
    }
    if (filters?.productId) {
      query = query.eq('product_id', filters.productId);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};

// ========================================
// Trip Items
// ========================================

export const tripItemService = {
  /**
   * ดึงสินค้าในทริป
   */
  async getByTripId(tripId: string) {
    const { data, error } = await supabase
      .from('trip_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('trip_id', tripId)
      .order('created_at');

    if (error) throw error;
    return data;
  },

  /**
   * เพิ่มสินค้าในทริป
   */
  async create(item: Omit<TripItem, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('trip_items')
      .insert(item)
      .select(`
        *,
        product:products(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * อัพเดทสินค้าในทริป
   */
  async update(id: string, updates: Partial<TripItem>) {
    const { data, error } = await supabase
      .from('trip_items')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        product:products(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ลบสินค้าจากทริป
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('trip_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * อัพเดทจำนวนที่โหลดจริง
   */
  async updateLoadedQuantity(id: string, quantity: number) {
    return this.update(id, { loaded_quantity: quantity });
  },

  /**
   * อัพเดทจำนวนที่ส่งมอบจริง
   */
  async updateDeliveredQuantity(id: string, quantity: number) {
    return this.update(id, { delivered_quantity: quantity });
  },
};

