import { supabase } from '../lib/supabase';

// Helper: แปลง Supabase/Postgres error เกี่ยวกับ RLS ให้เป็นข้อความที่อ่านง่าย
function mapOrdersError(error: any, action: 'create' | 'update' | 'assign' | 'unassign' | 'delete') {
  const message: string = error?.message || '';
  const code: string | undefined = error?.code;

  const isRlsViolation =
    code === '42501' || // Postgres insufficient_privilege (มักใช้กับ RLS)
    message.includes('violates row-level security policy');

  if (isRlsViolation) {
    if (action === 'create') {
      return new Error(
        'คุณไม่มีสิทธิ์สร้างออเดอร์ในตารางนี้หรือสาขานี้\n' +
        'กรุณาติดต่อผู้ดูแลระบบหรือผู้ดูแลสาขาให้เพิ่มสิทธิ์การเข้าถึงก่อน'
      );
    }

    if (action === 'assign') {
      return new Error(
        'คุณไม่มีสิทธิ์จัดทริปให้กับออเดอร์เหล่านี้\n' +
        'กรุณาติดต่อผู้ดูแลระบบหรือผู้ดูแลสาขาให้ตรวจสอบสิทธิ์การใช้งาน'
      );
    }

    if (action === 'unassign') {
      return new Error(
        'คุณไม่มีสิทธิ์ยกเลิกการกำหนดทริปของออเดอร์นี้\n' +
        'กรุณาติดต่อผู้ดูแลระบบหรือผู้ดูแลสาขาให้ตรวจสอบสิทธิ์การใช้งาน'
      );
    }

    if (action === 'delete') {
      return new Error(
        'คุณไม่มีสิทธิ์ลบออเดอร์ในระบบ\n' +
        'หากต้องการลบออเดอร์ กรุณาติดต่อผู้จัดการหรือผู้ดูแลระบบ'
      );
    }

    // default สำหรับ update ทั่วไป
    return new Error(
      'คุณไม่มีสิทธิ์แก้ไขออเดอร์นี้\n' +
      'กรุณาติดต่อผู้ดูแลระบบหรือผู้ดูแลสาขาให้ตรวจสอบสิทธิ์การใช้งาน'
    );
  }

  // ถ้าไม่ใช่ RLS error ให้คืน error เดิม
  return error;
}

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
  quantity_picked_up_at_store: number; // ลูกค้ารับที่หน้าร้านแล้ว (sales บันทึก)
  quantity_delivered: number;           // ส่งแล้ว (รวมทุก completed trips — auto)
  // computed (from view or service):
  quantity_remaining?: number;          // = quantity - picked_up - delivered
  unit_price: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  line_total: number | null;
  notes: string | null;
  is_bonus?: boolean;
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
    branch?: string;
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
    if (filters?.branch && filters.branch !== 'ALL') {
      query = query.eq('branch', filters.branch);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * รหัสออเดอร์รูปแบบเก่า (เช่น SD-ORD-2601-0017) ที่ไม่ได้ใช้แล้ว — ไม่แสดงในหน้ารอจัดทริป
   * รูปแบบใหม่: SD/HQ + YYMMDD + เลข 3 หลัก (ไม่มี -ORD-)
   */
  isOldOrderNumberFormat(orderNumber: string | null | undefined): boolean {
    if (!orderNumber || typeof orderNumber !== 'string') return false;
    return orderNumber.includes('-ORD-');
  },

  /**
   * ดึงออเดอร์ที่รอจัดทริป
   * แสดงเมื่อ: มียอดคงเหลือ > 0 และ (ยังไม่จัดทริป หรือ ทริป completed/cancelled)
   * ไม่แสดงเมื่อ: ส่งครบแล้ว (remaining<=0 หรือ status=delivered), กำลังจัดทริป (planned/in_progress), รหัสเก่า (-ORD-)
   * ยอดคงเหลือ = สั่ง - รับที่ร้าน - ส่งแล้ว (ส่งแล้วใช้ max ของ order_items.quantity_delivered กับยอดจากทริปที่ completed)
   */
  async getPendingOrders(filters?: { branch?: string }) {
    let query = supabase
      .from('orders_with_details')
      .select('*')
      .in('status', ['confirmed', 'partial', 'assigned'])
      .order('created_at', { ascending: true });

    if (filters?.branch && filters.branch !== 'ALL') {
      query = query.eq('branch', filters.branch);
    }

    const { data: orders, error } = await query;
    if (error) throw error;
    if (!orders?.length) return [];

    const orderIds = orders.map((o: any) => o.id);
    const orderMap = new Map<string, any>(orders.map((o: any) => [o.id, o]));

    // ดึง delivery_trip_id + status จากตาราง orders โดยตรง (ไม่พึ่ง view) เพื่อให้กรองถูกต้อง
    const { data: ordersRaw } = await supabase
      .from('orders')
      .select('id, delivery_trip_id, store_id, status')
      .in('id', orderIds);
    const orderIdToTripAndStore = new Map<string, { delivery_trip_id: string | null; store_id: string | null; status: string }>();
    const orderIdToStatus = new Map<string, string>();
    (ordersRaw ?? []).forEach((r: any) => {
      const status = String(r.status ?? '').toLowerCase();
      orderIdToTripAndStore.set(r.id, {
        delivery_trip_id: r.delivery_trip_id ?? null,
        store_id: r.store_id ?? null,
        status,
      });
      orderIdToStatus.set(r.id, status);
    });
    // รวบรวม trip id จากทั้ง orders table และ view (เผื่อ RLS หรือ row หาย)
    const tripIdsFromOrders = [...new Set([
      ...(ordersRaw ?? []).map((r: any) => r.delivery_trip_id).filter(Boolean),
      ...orders.map((o: any) => o.delivery_trip_id).filter(Boolean),
    ])] as string[];
    const tripIdToStatus = new Map<string, string>();
    if (tripIdsFromOrders.length > 0) {
      const { data: trips } = await supabase
        .from('delivery_trips')
        .select('id, status')
        .in('id', tripIdsFromOrders);
      (trips ?? []).forEach((t: any) =>
        tripIdToStatus.set(t.id, String(t.status ?? '').toLowerCase())
      );
    }

    const completedTripIds = new Set(
      tripIdsFromOrders.filter((tid) => tripIdToStatus.get(tid) === 'completed')
    );

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, product_id, quantity, quantity_picked_up_at_store, quantity_delivered')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('[ordersService.getPendingOrders] order_items error:', itemsError);
      return [];
    }

    const tripDeliveredByStoreProduct = new Map<string, Map<string, number>>();
    if (completedTripIds.size > 0) {
      const completedIds = [...completedTripIds];
      const { data: tripStores } = await supabase
        .from('delivery_trip_stores')
        .select('id, delivery_trip_id, store_id')
        .in('delivery_trip_id', completedIds);
      if (tripStores?.length) {
        const tripStoreIds = tripStores.map((ts: any) => ts.id);
        const { data: tripItems } = await supabase
          .from('delivery_trip_items')
          .select('delivery_trip_store_id, product_id, quantity')
          .in('delivery_trip_store_id', tripStoreIds);
        const tsById = new Map<string, { delivery_trip_id: string; store_id: string }>(
          tripStores.map((ts: any) => [ts.id, { delivery_trip_id: ts.delivery_trip_id, store_id: ts.store_id }])
        );
        for (const ti of tripItems ?? []) {
          const ts = tsById.get(ti.delivery_trip_store_id);
          if (!ts) continue;
          const key = `${ts.delivery_trip_id}_${ts.store_id}`;
          if (!tripDeliveredByStoreProduct.has(key)) tripDeliveredByStoreProduct.set(key, new Map());
          const byProduct = tripDeliveredByStoreProduct.get(key)!;
          const q = Number(ti.quantity) || 0;
          byProduct.set(ti.product_id, (byProduct.get(ti.product_id) ?? 0) + q);
        }
      }
    }

    const orderIdToRemaining = new Map<string, number>();
    for (const row of items ?? []) {
      const meta = orderIdToTripAndStore.get(row.order_id);
      const pickedUp = Number(row.quantity_picked_up_at_store ?? 0);
      let delivered = Number(row.quantity_delivered ?? 0);
      if (meta?.delivery_trip_id && meta?.store_id && completedTripIds.has(meta.delivery_trip_id)) {
        const key = `${meta.delivery_trip_id}_${meta.store_id}`;
        const byProduct = tripDeliveredByStoreProduct.get(key);
        const fromTrip = byProduct ? (byProduct.get(row.product_id) ?? 0) : 0;
        if (delivered < fromTrip) delivered = fromTrip;
      }
      const rem = Math.max(0, Number(row.quantity) - pickedUp - delivered);
      orderIdToRemaining.set(row.order_id, (orderIdToRemaining.get(row.order_id) ?? 0) + rem);
    }

    return orders.filter((o: any) => {
      if (this.isOldOrderNumberFormat(o.order_number)) return false;

      const orderStatus = (orderIdToStatus.get(o.id) ?? String(o.status ?? '')).toLowerCase();
      if (orderStatus === 'delivered') return false;

      const remaining = orderIdToRemaining.get(o.id) ?? 0;
      if (remaining <= 0) return false;

      const meta = orderIdToTripAndStore.get(o.id);
      const tripId = meta?.delivery_trip_id ?? o.delivery_trip_id ?? null;
      if (tripId == null || tripId === '') return true;

      const tripStatus = (tripIdToStatus.get(tripId) ?? '').toLowerCase();
      if (tripStatus === 'completed' || tripStatus === 'cancelled') return true;
      // ทริปถูกลบ (hard delete) — ไม่พบใน delivery_trips — ให้แสดงออเดอร์เพื่อให้สามารถจัดทริปใหม่ได้
      if (tripStatus === '') return true;
      return false;
    });
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

    if (orderError) {
      throw mapOrdersError(orderError, 'create');
    }

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

    if (error) {
      throw mapOrdersError(error, 'update');
    }
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
   * ใช้ RPC assign_orders_to_trip เพื่อ assign + สร้าง order_number ใน transaction เดียว (ไม่ซ้ำ)
   * ถ้า RPC ยังไม่มี (ยังไม่รัน migration) จะ fallback เป็นอัปเดตทีละออเดอร์
   */
  async assignToTrip(orderIds: string[], tripId: string, updatedBy: string) {
    if (orderIds.length === 0) {
      return { updated: 0, orderNumbersGenerated: 0 };
    }

    // 1. ลองใช้ RPC ก่อน (assign + สร้าง order_number ใน DB ครั้งเดียว ไม่ซ้ำ)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('assign_orders_to_trip', {
      p_order_ids: orderIds,
      p_trip_id: tripId,
      p_updated_by: updatedBy,
    });

    if (!rpcError) {
      const rows = Array.isArray(rpcResult) ? rpcResult : [];
      const updatedCount = rows.length > 0 ? Number(rows[0]?.updated_count ?? rows.length) : 0;
      return {
        updated: updatedCount,
        orderNumbersGenerated: rows.filter((r: any) => r?.order_number).length,
      };
    }

    // ถ้า RPC ไม่มี (ยังไม่รัน migration) หรือ error อื่น → fallback อัปเดตทีละออเดอร์
    if (rpcError.code === '42883') {
      console.warn('[ordersService] assign_orders_to_trip RPC not found, falling back to one-by-one update. Run migration: sql/20260230000000_assign_orders_to_trip_rpc.sql');
    } else {
      console.warn('[ordersService] assign_orders_to_trip RPC failed, falling back to one-by-one:', rpcError.message);
    }

    const updatedOrders: Array<{ id: string; status: string; delivery_trip_id: string }> = [];
    const payload = {
      delivery_trip_id: tripId,
      status: 'assigned' as const,
      updated_by: updatedBy,
    };

    for (const orderId of orderIds) {
      const { data: row, error: updateError } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
        .select('id, status, delivery_trip_id')
        .single();

      if (updateError) {
        console.error('[ordersService] Failed to update orders:', {
          error: updateError,
          orderIds,
          tripId,
          code: updateError.code,
          message: updateError.message,
        });
        if (updateError.code === 'PGRST116') {
          throw new Error('ไม่สามารถอัปเดตออเดอร์ได้: ไม่พบข้อมูลหรือไม่มีสิทธิ์ (RLS Policy) - กรุณารัน migration ใน Supabase Dashboard');
        }
        if (updateError.code === '23505') {
          throw new Error('ไม่สามารถอัปเดตออเดอร์ได้: เลขที่ออเดอร์ซ้ำ (duplicate order_number) - กรุณารัน migration: sql/20260230000000_assign_orders_to_trip_rpc.sql แล้วลองใหม่');
        }
        if (updateError.code === '42883') {
          throw new Error(
            `ไม่สามารถอัปเดตออเดอร์ได้: ${updateError.message || 'Unknown error'} - กรุณารัน migration: sql/FINAL_FIX.sql`
          );
        }
        const mapped = mapOrdersError(updateError, 'assign');
        if (mapped !== updateError) throw mapped;
        throw new Error(`ไม่สามารถอัปเดตออเดอร์ได้: ${updateError.message || 'Unknown error'}`);
      }
      if (row) updatedOrders.push(row);
    }

    if (updatedOrders.length === 0) {
      throw new Error('ไม่สามารถอัปเดตออเดอร์ได้: อาจเป็นปัญหา RLS Policy - กรุณารัน migration: sql/FINAL_FIX.sql');
    }

    const { data: orderNumbers } = await supabase.rpc('generate_order_numbers_for_trip', {
      p_trip_id: tripId,
    });

    return {
      updated: updatedOrders.length,
      orderNumbersGenerated: Array.isArray(orderNumbers) ? orderNumbers.length : 0,
    };
  },

  /**
   * ยกเลิกการกำหนดทริป และล้างรหัสออเดอร์ (order_number) เพื่อให้สามารถจัดทริปใหม่ได้
   */
  async unassignFromTrip(orderIds: string[], updatedBy: string) {
    const { error } = await supabase
      .from('orders')
      .update({
        delivery_trip_id: null,
        order_number: null,
        status: 'confirmed',
        updated_by: updatedBy,
      })
      .in('id', orderIds);

    if (error) {
      throw mapOrdersError(error, 'unassign');
    }
  },

  /**
   * ลบออเดอร์
   */
  async delete(id: string) {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      throw mapOrdersError(error, 'delete');
    }
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
          const mapped = mapOrdersError(error, 'delete');
          console.error(`[ordersService] Error deleting order ${id}:`, mapped);
          errors.push({ id, error: mapped.message });
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

    // Compute quantity_remaining client-side
    return (data || []).map(item => ({
      ...item,
      quantity_picked_up_at_store: Number(item.quantity_picked_up_at_store ?? 0),
      quantity_delivered: Number(item.quantity_delivered ?? 0),
      quantity_remaining: Math.max(
        0,
        Number(item.quantity)
        - Number(item.quantity_picked_up_at_store ?? 0)
        - Number(item.quantity_delivered ?? 0)
      ),
    }));
  },

  /**
   * อัปเดตจำนวนที่ลูกค้ารับที่หน้าร้าน (ฝ่ายขายเป็นผู้บันทึก)
   * ต้องเป็นจำนวนเต็มเท่านั้น — จำนวนที่ต้องส่ง = quantity - quantity_picked_up_at_store - quantity_delivered
   */
  async updatePickedUpAtStore(itemId: string, quantityPickedUp: number): Promise<void> {
    const qty = Math.max(0, Math.floor(Number(quantityPickedUp) || 0));
    const { error } = await supabase
      .from('order_items')
      .update({
        quantity_picked_up_at_store: qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      console.error('[orderItemsService] Error updating quantity_picked_up_at_store:', error);
      throw error;
    }
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

