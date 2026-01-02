import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];

type OrderItem = Database['public']['Tables']['order_items']['Row'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];

// ========================================
// Orders Service
// ========================================

export const ordersService = {
  /**
   * ดึงออเดอร์ทั้งหมด
   */
  async getAll(filters?: {
    status?: string;
    storeId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    let query = supabase
      .from('orders_with_details')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.storeId) {
      query = query.eq('store_id', filters.storeId);
    }
    if (filters?.dateFrom) {
      query = query.gte('order_date', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('order_date', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * ดึงออเดอร์ที่รอจัดทริป
   */
  async getPendingOrders() {
    const { data, error } = await supabase
      .from('pending_orders')
      .select('*')
      .order('order_date')
      .order('created_at');

    if (error) throw error;
    return data;
  },

  /**
   * ดึงออเดอร์ตาม ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('orders_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * สร้างออเดอร์ใหม่พร้อมรายการสินค้า
   */
  async createWithItems(
    orderData: Omit<OrderInsert, 'id' | 'created_at' | 'updated_at'>,
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      discount_percent?: number;
    }>
  ) {
    // สร้างออเดอร์
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) throw orderError;

    // สร้างรายการสินค้า
    const orderItems = items.map((item) => {
      const discountAmount = (item.unit_price * item.quantity * (item.discount_percent || 0)) / 100;
      const lineTotal = (item.unit_price * item.quantity) - discountAmount;

      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: discountAmount,
        line_total: lineTotal,
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return order;
  },

  /**
   * อัพเดทออเดอร์
   */
  async update(id: string, updates: OrderUpdate) {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * เปลี่ยนสถานะออเดอร์
   */
  async updateStatus(
    id: string,
    status: string,
    updatedBy: string,
    reason?: string
  ) {
    const updates: any = {
      status,
      updated_by: updatedBy,
    };

    // ถ้า confirm ให้บันทึกผู้อนุมัติและเวลา
    if (status === 'confirmed') {
      updates.confirmed_by = updatedBy;
      updates.confirmed_at = new Date().toISOString();
    }

    return this.update(id, updates);
  },

  /**
   * ยกเลิกออเดอร์
   */
  async cancel(id: string, updatedBy: string, reason: string) {
    return this.updateStatus(id, 'cancelled', updatedBy, reason);
  },

  /**
   * กำหนดออเดอร์ให้กับทริป
   */
  async assignToTrip(orderIds: string[], tripId: string, updatedBy: string) {
    const { error } = await supabase
      .from('orders')
      .update({
        delivery_trip_id: tripId,
        status: 'assigned',
        updated_by: updatedBy,
      })
      .in('id', orderIds);

    if (error) throw error;
  },

  /**
   * ยกเลิกการกำหนดทริป
   */
  async unassignFromTrip(orderIds: string[], updatedBy: string) {
    const { error } = await supabase
      .from('orders')
      .update({
        delivery_trip_id: null,
        status: 'confirmed',
        updated_by: updatedBy,
      })
      .in('id', orderIds);

    if (error) throw error;
  },
};

// ========================================
// Order Items Service
// ========================================

export const orderItemsService = {
  /**
   * ดึงรายการสินค้าในออเดอร์
   */
  async getByOrderId(orderId: string) {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('order_id', orderId)
      .order('created_at');

    if (error) throw error;
    return data;
  },

  /**
   * เพิ่มรายการสินค้า
   */
  async add(item: OrderItemInsert) {
    const discountAmount = (item.unit_price * item.quantity * (item.discount_percent || 0)) / 100;
    const lineTotal = (item.unit_price * item.quantity) - discountAmount;

    const { data, error } = await supabase
      .from('order_items')
      .insert({
        ...item,
        discount_amount: discountAmount,
        line_total: lineTotal,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * อัพเดทรายการสินค้า
   */
  async update(id: string, updates: Partial<OrderItem>) {
    // คำนวณยอดใหม่ถ้ามีการเปลี่ยนแปลง
    if (updates.quantity || updates.unit_price || updates.discount_percent) {
      const quantity = updates.quantity || 0;
      const unitPrice = updates.unit_price || 0;
      const discountPercent = updates.discount_percent || 0;

      const discountAmount = (unitPrice * quantity * discountPercent) / 100;
      const lineTotal = (unitPrice * quantity) - discountAmount;

      updates.discount_amount = discountAmount;
      updates.line_total = lineTotal;
    }

    const { data, error } = await supabase
      .from('order_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ลบรายการสินค้า
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ========================================
// Order Statistics
// ========================================

export const orderStatsService = {
  /**
   * สถิติออเดอร์
   */
  async getStats(dateFrom?: string, dateTo?: string) {
    let query = supabase
      .from('orders')
      .select('status, total_amount');

    if (dateFrom) {
      query = query.gte('order_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('order_date', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter((o) => o.status === 'pending').length,
      confirmed: data.filter((o) => o.status === 'confirmed').length,
      assigned: data.filter((o) => o.status === 'assigned').length,
      in_delivery: data.filter((o) => o.status === 'in_delivery').length,
      delivered: data.filter((o) => o.status === 'delivered').length,
      cancelled: data.filter((o) => o.status === 'cancelled').length,
      total_amount: data.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    };

    return stats;
  },

  /**
   * ยอดขายตามช่วงเวลา
   */
  async getSalesByPeriod(period: 'day' | 'week' | 'month', limit: number = 30) {
    const { data, error } = await supabase.rpc('get_sales_by_period', {
      p_period: period,
      p_limit: limit,
    });

    if (error) {
      // ถ้ายังไม่มี function ให้ใช้วิธีอื่น
      console.warn('Function get_sales_by_period not found, using fallback');
      return [];
    }

    return data;
  },
};

