import { supabase } from '../lib/supabase';

// Temporary types until database.ts is regenerated
type Order = {
  id: string;
  order_number: string | null;
  store_id: string;
  customer_id: string | null;
  sales_person_id: string | null;
  order_date: string;
  delivery_date: string | null;
  delivery_address: string | null;
  status: string;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  delivery_trip_id: string | null;
};

type OrderInsert = {
  id?: string;
  order_number?: string | null;
  store_id: string; // Required
  customer_id?: string | null;
  sales_person_id?: string | null;
  order_date: string; // Required
  delivery_date?: string | null;
  delivery_address?: string | null;
  status: string; // Required
  total_amount?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  delivery_trip_id?: string | null;
  warehouse_id?: string | null;
};

type OrderUpdate = Partial<OrderInsert>;

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  line_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OrderItemInsert = Omit<OrderItem, 'id' | 'created_at' | 'updated_at' | 'discount_amount' | 'line_total' | 'notes'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  discount_amount?: number | null;
  line_total?: number | null;
  notes?: string | null;
};

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
    orderData: Omit<OrderInsert, 'id' | 'created_at' | 'updated_at'> & { warehouse_id?: string },
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      discount_percent?: number;
      is_bonus?: boolean;
    }>
  ) {
    // สร้างออเดอร์
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData as any)
      .select()
      .single();

    if (orderError) throw orderError;

    // สร้างรายการสินค้า
    const orderItems = items.map((item) => {
      // ของแถมราคาเป็น 0 เสมอ
      const actualUnitPrice = item.is_bonus ? 0 : item.unit_price;
      const discountAmount = (actualUnitPrice * item.quantity * (item.discount_percent || 0)) / 100;
      const lineTotal = (actualUnitPrice * item.quantity) - discountAmount;

      const orderItem: any = {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: actualUnitPrice,
        discount_percent: item.discount_percent || 0,
        discount_amount: discountAmount,
        line_total: lineTotal,
      };

      // เพิ่ม is_bonus ถ้ามี (รองรับกรณีที่ migration ยังไม่ได้รัน)
      if (item.is_bonus !== undefined) {
        orderItem.is_bonus = item.is_bonus;
      }

      return orderItem;
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
   * ระบบจะสร้าง order_number อัตโนมัติตามลำดับ sequence_order ในทริป
   */
  async assignToTrip(orderIds: string[], tripId: string, updatedBy: string) {
    // 1. Update orders to assign to trip (trigger will generate order_number)
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        delivery_trip_id: tripId,
        status: 'assigned',
        updated_by: updatedBy,
      })
      .in('id', orderIds);

    if (updateError) throw updateError;

    // 2. Generate order numbers for all orders in trip (ตามลำดับ sequence_order)
    // ใช้ database function เพื่อให้แน่ใจว่าเรียงตามลำดับที่ถูกต้อง
    const { data: orderNumbers, error: generateError } = await supabase
      .rpc('generate_order_numbers_for_trip', {
        p_trip_id: tripId,
      });

    if (generateError) {
      console.error('[ordersService] Error generating order numbers:', generateError);
      // ไม่ throw error เพราะ order อาจมี order_number อยู่แล้ว
      // แต่ log เพื่อ debug
    }

    // 3. Verify that all orders have order_numbers
    const { data: ordersWithoutNumber, error: checkError } = await supabase
      .from('orders')
      .select('id')
      .in('id', orderIds)
      .or('order_number.is.null,order_number.eq.');

    if (checkError) {
      console.warn('[ordersService] Error checking order numbers:', checkError);
    } else if (ordersWithoutNumber && ordersWithoutNumber.length > 0) {
      console.warn(
        `[ordersService] ${ordersWithoutNumber.length} orders still missing order_number after assignment`
      );
    }
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

  /**
   * ลบออเดอร์
   */
  async delete(id: string) {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * ลบออเดอร์หลายรายการ
   */
  async deleteMany(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new Error('ไม่มีออเดอร์ที่ต้องการลบ');
    }

    // ลบทีละรายการเพื่อให้เห็น error ที่ชัดเจนขึ้น
    const deletedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .delete()
          .eq('id', id)
          .select('id')
          .single();

        if (error) {
          console.error(`[ordersService] Error deleting order ${id}:`, error);
          errors.push({ id, error: error.message });
        } else if (data) {
          deletedIds.push(id);
        } else {
          errors.push({ id, error: 'ไม่พบออเดอร์หรือไม่มีสิทธิ์ลบ' });
        }
      } catch (err: any) {
        console.error(`[ordersService] Exception deleting order ${id}:`, err);
        errors.push({ id, error: err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ' });
      }
    }

    // ถ้ามี error บางรายการ แสดง error message
    if (errors.length > 0 && deletedIds.length === 0) {
      const errorMessages = errors.map(e => `- ${e.id}: ${e.error}`).join('\n');
      throw new Error(
        `ไม่สามารถลบออเดอร์ได้:\n${errorMessages}\n\n` +
        `กรุณาตรวจสอบ:\n` +
        `1. สิทธิ์การลบ (ต้องเป็น Admin/Manager)\n` +
        `2. ออเดอร์ไม่ถูกกำหนดทริปแล้ว (delivery_trip_id = null)\n` +
        `3. ไม่มี foreign key constraint ที่ป้องกันการลบ`
      );
    }

    // ถ้าลบได้บางรายการ แสดง warning
    if (errors.length > 0 && deletedIds.length > 0) {
      const errorMessages = errors.map(e => `- ${e.id}: ${e.error}`).join('\n');
      console.warn(`[ordersService] Some orders failed to delete:\n${errorMessages}`);
    }

    return deletedIds.map(id => ({ id }));
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

