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
  payment_status: string | null;
  delivery_time_slot: string | null;
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
  payment_status?: string | null;
  delivery_time_slot?: string | null;
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
  fulfillment_method: 'delivery' | 'pickup'; // delivery = จัดส่ง, pickup = ลูกค้ามารับเอง
  created_at: string;
  updated_at: string;
};

type OrderItemInsert = Omit<OrderItem, 'id' | 'created_at' | 'updated_at' | 'discount_amount' | 'line_total' | 'notes' | 'quantity_picked_up_at_store' | 'quantity_delivered' | 'quantity_remaining' | 'fulfillment_method'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  discount_amount?: number | null;
  line_total?: number | null;
  notes?: string | null;
  quantity_picked_up_at_store?: number;
  quantity_delivered?: number;
  quantity_remaining?: number;
  fulfillment_method?: 'delivery' | 'pickup';
};

/** รายการ pickup ที่รอรับ (quantity_picked_up_at_store < quantity) พร้อม order + store + product */
export interface PickupPendingItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  quantity_picked_up_at_store: number;
  quantity_remaining: number;
  order: {
    id: string;
    order_number: string | null;
    order_date: string;
    store: {
      id: string;
      customer_code: string;
      customer_name: string;
      address: string | null;
      branch: string | null;
    };
  };
  product: {
    id: string;
    product_code: string;
    product_name: string;
    category: string | null;
    unit: string;
  };
}

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
   * ดึงออเดอร์ที่รอจัดทริป — เฉพาะออเดอร์ที่ยังไม่เคยจัดทริป
   * แสดงเมื่อ: delivery_trip_id IS NULL, remaining > 0, status ไม่ใช่ delivered, ไม่ใช้รหัสเก่า (-ORD-)
   * remaining = สั่ง - รับที่ร้าน - ส่งแล้ว (จาก order_items)
   */
  async getPendingOrders(filters?: { branch?: string }) {
    let query = supabase
      .from('orders_with_details')
      .select('*')
      .in('status', ['confirmed', 'partial', 'assigned'])
      .is('delivery_trip_id', null) // เฉพาะออเดอร์ที่ยังไม่จัดทริป
      .order('created_at', { ascending: true });

    if (filters?.branch && filters.branch !== 'ALL') {
      query = query.eq('branch', filters.branch);
    }

    const { data: orders, error } = await query;
    if (error) throw error;
    if (!orders?.length) return [];

    const orderIds = orders.map((o: any) => o.id);

    const { data: ordersRaw } = await supabase
      .from('orders')
      .select('id, status')
      .in('id', orderIds);
    const orderIdToStatus = new Map<string, string>();
    (ordersRaw ?? []).forEach((r: any) => {
      orderIdToStatus.set(r.id, String(r.status ?? '').toLowerCase());
    });

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, product_id, quantity, quantity_picked_up_at_store, quantity_delivered, fulfillment_method')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('[ordersService.getPendingOrders] order_items error:', itemsError);
      return [];
    }

    // ออเดอร์ที่ยังไม่มีทริป — remaining คำนวณเฉพาะ fulfillment_method = 'delivery'
    // รายการ pickup ไม่นำมานับ (ลูกค้ามารับเอง ไม่ต้องจัดทริป)
    const orderIdToRemaining = new Map<string, number>();
    for (const row of items ?? []) {
      const method = (row.fulfillment_method ?? 'delivery') as string;
      if (method === 'pickup') continue;

      const pickedUp = Number(row.quantity_picked_up_at_store ?? 0);
      const delivered = Number(row.quantity_delivered ?? 0);
      const rem = Math.max(0, Number(row.quantity) - pickedUp - delivered);
      orderIdToRemaining.set(row.order_id, (orderIdToRemaining.get(row.order_id) ?? 0) + rem);
    }

    return orders.filter((o: any) => {
      if (this.isOldOrderNumberFormat(o.order_number)) return false;
      const orderStatus = (orderIdToStatus.get(o.id) ?? String(o.status ?? '')).toLowerCase();
      if (orderStatus === 'delivered') return false;
      const remaining = orderIdToRemaining.get(o.id) ?? 0;
      if (remaining <= 0) return false;
      return true; // delivery_trip_id IS NULL แล้วจาก query ต้นทาง
    });
  },

  /**
   * สร้าง order_number สำหรับออเดอร์รับเองทั้งหมด (ที่ไม่มีทริป)
   * เรียกเมื่อสร้างหรือยืนยันออเดอร์ที่ทุกรายการเป็น pickup
   */
  async ensureOrderNumberForPickupOrder(orderId: string): Promise<string | null> {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return null;
    if (order.order_number && !order.order_number.startsWith('TEMP-')) return order.order_number;

    const { data: rpcResult, error } = await supabase.rpc('generate_order_number_for_pickup', {
      p_order_id: orderId,
    });

    if (error) {
      console.warn('[ordersService] generate_order_number_for_pickup failed:', error?.message);
      return null;
    }

    const newNum = typeof rpcResult === 'string' ? rpcResult : rpcResult != null ? String(rpcResult) : null;
    if (!newNum) return null;
    await supabase.from('orders').update({ order_number: newNum }).eq('id', orderId);
    return newNum;
  },

  /**
   * ดึงรายการรอรับเอง (fulfillment_method = 'pickup') ที่ยังรับไม่ครบ
   * ใช้สำหรับหน้ารายการรอรับเอง และพิมพ์ใบเบิก
   */
  async getPickupPendingItems(filters?: { branch?: string }): Promise<PickupPendingItem[]> {
    const { data: items, error } = await supabase
      .from('order_items')
      .select(
        `
        id,
        order_id,
        product_id,
        quantity,
        quantity_picked_up_at_store,
        order:orders(
          id,
          order_number,
          order_date,
          store_id,
          stores(id, customer_code, customer_name, address, branch)
        ),
        product:products(
          id,
          product_code,
          product_name,
          category,
          unit
        )
      `
      )
      .eq('fulfillment_method', 'pickup');

    if (error) throw error;
    if (!items?.length) return [];

    // กรองเฉพาะรายการที่ยังรับไม่ครบ (quantity_picked_up_at_store < quantity)
    const pending = items.filter((row: any) => {
      const qty = Number(row.quantity ?? 0);
      const pickedUp = Number(row.quantity_picked_up_at_store ?? 0);
      if (qty - pickedUp <= 0) return false;

      if (filters?.branch && filters.branch !== 'ALL') {
        const store = row.order?.stores ?? row.order?.store;
        const branch = store?.branch ?? null;
        if (branch !== filters.branch) return false;
      }
      return true;
    });

    return pending.map((row: any) => {
      const order = row.order;
      const store = order?.stores ?? order?.store ?? {};
      const product = row.product ?? {};
      const qty = Number(row.quantity ?? 0);
      const pickedUp = Number(row.quantity_picked_up_at_store ?? 0);

      return {
        id: row.id,
        order_id: row.order_id,
        product_id: row.product_id,
        quantity: qty,
        quantity_picked_up_at_store: pickedUp,
        quantity_remaining: qty - pickedUp,
        order: {
          id: order?.id ?? row.order_id,
          order_number: order?.order_number ?? null,
          order_date: order?.order_date ?? '',
          store: {
            id: store?.id ?? '',
            customer_code: store?.customer_code ?? '-',
            customer_name: store?.customer_name ?? '-',
            address: store?.address ?? null,
            branch: store?.branch ?? null,
          },
        },
        product: {
          id: product?.id ?? row.product_id,
          product_code: product?.product_code ?? '-',
          product_name: product?.product_name ?? '-',
          category: product?.category ?? null,
          unit: product?.unit ?? '',
        },
      };
    });
  },

  /**
   * ยืนยันลูกค้ามารับแล้ว — อัปเดต quantity_picked_up_at_store = quantity สำหรับ pickup items
   * แล้วตรวจสอบว่าออเดอร์ครบทุกรายการหรือไม่ → อัปเดต status = 'delivered'
   */
  async markPickupItemsFulfilled(
    orderId: string,
    itemIds?: string[],
    updatedBy?: string
  ): Promise<{ updated: number; orderStatus?: string }> {
    const { data: allItems, error: fetchError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, quantity_picked_up_at_store, quantity_delivered, fulfillment_method')
      .eq('order_id', orderId);

    if (fetchError) throw fetchError;
    if (!allItems?.length) return { updated: 0 };

    const pickupItems = allItems.filter((r: any) => (r.fulfillment_method ?? 'delivery') === 'pickup');
    const toUpdate = itemIds?.length
      ? pickupItems.filter((i: any) => itemIds.includes(i.id))
      : pickupItems.filter((i: any) => Number(i.quantity_picked_up_at_store ?? 0) < Number(i.quantity));

    if (toUpdate.length === 0) return { updated: 0 };

    for (const item of toUpdate) {
      const { error } = await supabase
        .from('order_items')
        .update({
          quantity_picked_up_at_store: Number(item.quantity),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;
    }

    const itemsAfterUpdate = allItems.map((r: any) => {
      const matched = toUpdate.find((t: any) => t.id === r.id);
      if (matched) {
        return { ...r, quantity_picked_up_at_store: Number(matched.quantity) };
      }
      return r;
    });

    let orderStatus: string | undefined;
    const allFulfilled = itemsAfterUpdate.every((r: any) => {
      const qty = Number(r.quantity);
      const pickedUp = Number(r.quantity_picked_up_at_store ?? 0);
      const delivered = Number(r.quantity_delivered ?? 0);
      const method = (r.fulfillment_method ?? 'delivery') as string;
      if (method === 'pickup') return pickedUp >= qty;
      return pickedUp + delivered >= qty;
    });

    if (allFulfilled) {
      await this.ensureOrderNumberForPickupOrder(orderId);
      await supabase
        .from('orders')
        .update({
          status: 'delivered',
          updated_by: updatedBy ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      orderStatus = 'delivered';
    }

    return { updated: toUpdate.length, orderStatus };
  },

  /**
   * ดึงประวัติออเดอร์รับเองที่รับครบแล้ว (status = delivered, delivery_trip_id = null)
   * สำหรับแสดงในส่วน "ประวัติที่รับแล้ว"
   */
  async getPickupFulfilledOrders(filters?: { branch?: string }): Promise<any[]> {
    const { data: orders, error } = await supabase
      .from('orders_with_details')
      .select('*')
      .eq('status', 'delivered')
      .is('delivery_trip_id', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (!orders?.length) return [];

    const orderIds = orders.map((o: any) => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, fulfillment_method')
      .in('order_id', orderIds);

    const orderIdToAllPickup = new Map<string, boolean>();
    const orderIdToSomePickup = new Map<string, boolean>();
    for (const oid of orderIds) {
      const orderItems = (items ?? []).filter((i: any) => i.order_id === oid);
      const allPickup = orderItems.length > 0 && orderItems.every((i: any) => (i.fulfillment_method ?? 'delivery') === 'pickup');
      const somePickup = orderItems.some((i: any) => (i.fulfillment_method ?? 'delivery') === 'pickup');
      orderIdToAllPickup.set(oid, allPickup);
      orderIdToSomePickup.set(oid, somePickup);
    }

    let result = orders.filter((o: any) => orderIdToAllPickup.get(o.id));
    if (filters?.branch && filters.branch !== 'ALL') {
      result = result.filter((o: any) => o.branch === filters.branch);
    }
    return result;
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
      fulfillment_method?: 'delivery' | 'pickup';
    }>,
    payment_status?: string | null,
    delivery_time_slot?: string | null
  ) {
    const payload: Record<string, unknown> = {
      ...orderData,
      payment_status: payment_status && payment_status.trim() ? payment_status.trim() : null,
      delivery_time_slot: delivery_time_slot && delivery_time_slot.trim() ? delivery_time_slot.trim() : null,
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(payload as any)
      .select()
      .single();

    if (orderError) {
      console.error('[ordersService.createWithItems] Insert error:', {
        message: orderError.message,
        code: orderError.code,
        details: orderError.details,
      });
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
        fulfillment_method: item.fulfillment_method || 'delivery',
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

    // ออเดอร์รับเองทั้งหมด → สร้าง order_number ทันที (ไม่ผ่านทริป)
    const allPickup = items.every((i) => (i.fulfillment_method ?? 'delivery') === 'pickup');
    if (allPickup) {
      try {
        await this.ensureOrderNumberForPickupOrder(order.id);
        return (await supabase.from('orders').select('*').eq('id', order.id).single()).data ?? order;
      } catch {
        return order;
      }
    }

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

