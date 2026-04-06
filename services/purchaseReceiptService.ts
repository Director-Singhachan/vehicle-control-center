import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type PurchaseReceipt = Database['public']['Tables']['purchase_receipts']['Row'];
type PurchaseReceiptInsert = Database['public']['Tables']['purchase_receipts']['Insert'];
type PurchaseReceiptItemInsert = Database['public']['Tables']['purchase_receipt_items']['Insert'];
type MovingAvgRow = Database['public']['Tables']['product_moving_avg_costs']['Row'];

export interface PurchaseReceiptLineInput {
  product_id: string;
  quantity: number;
  unit?: string | null;
  unit_cost: number;
}

export interface CreateDraftInput {
  receipt_date: string;
  warehouse_id: string;
  supplier_name?: string | null;
  invoice_ref?: string | null;
  notes?: string | null;
  created_by: string;
  lines: PurchaseReceiptLineInput[];
}

async function ensureDraft(receiptId: string): Promise<PurchaseReceipt> {
  const { data, error } = await supabase
    .from('purchase_receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (error) throw error;
  if (data.status !== 'draft') {
    throw new Error('แก้ไขได้เฉพาะใบที่ยังเป็นร่าง');
  }
  return data;
}

export const purchaseReceiptService = {
  async list(options?: {
    warehouseId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<PurchaseReceipt[]> {
    let q = supabase
      .from('purchase_receipts')
      .select('*')
      .order('receipt_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 200);

    if (options?.warehouseId) q = q.eq('warehouse_id', options.warehouseId);
    if (options?.status) q = q.eq('status', options.status);
    if (options?.dateFrom) q = q.gte('receipt_date', options.dateFrom);
    if (options?.dateTo) q = q.lte('receipt_date', options.dateTo);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as PurchaseReceipt[];
  },

  async getWithItems(receiptId: string) {
    const { data: header, error: hErr } = await supabase
      .from('purchase_receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (hErr) throw hErr;

    const { data: items, error: iErr } = await supabase
      .from('purchase_receipt_items')
      .select(
        `
        *,
        product:products!purchase_receipt_items_product_id_fkey ( id, product_code, product_name, unit )
      `,
      )
      .eq('purchase_receipt_id', receiptId)
      .order('created_at', { ascending: true });

    if (iErr) throw iErr;

    return { header: header as PurchaseReceipt, items: items ?? [] };
  },

  /**
   * สร้างใบร่างพร้อมรายการสินค้า
   */
  async createDraft(input: CreateDraftInput): Promise<PurchaseReceipt> {
    if (!input.lines?.length) {
      throw new Error('ต้องมีอย่างน้อยหนึ่งรายการสินค้า');
    }

    const headerPayload: PurchaseReceiptInsert = {
      receipt_date: input.receipt_date,
      warehouse_id: input.warehouse_id,
      supplier_name: input.supplier_name ?? null,
      invoice_ref: input.invoice_ref ?? null,
      notes: input.notes ?? null,
      status: 'draft',
      created_by: input.created_by,
    };

    const { data: receipt, error: rErr } = await supabase
      .from('purchase_receipts')
      .insert(headerPayload)
      .select()
      .single();

    if (rErr) throw rErr;

    const itemRows: PurchaseReceiptItemInsert[] = input.lines.map((line) => ({
      purchase_receipt_id: receipt.id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit: line.unit ?? null,
      unit_cost: line.unit_cost,
    }));

    const { error: iErr } = await supabase.from('purchase_receipt_items').insert(itemRows);
    if (iErr) throw iErr;

    return receipt as PurchaseReceipt;
  },

  async updateDraftHeader(
    receiptId: string,
    patch: Partial<Pick<PurchaseReceipt, 'receipt_date' | 'warehouse_id' | 'supplier_name' | 'invoice_ref' | 'notes'>>,
  ): Promise<void> {
    await ensureDraft(receiptId);
    const { error } = await supabase.from('purchase_receipts').update(patch).eq('id', receiptId);
    if (error) throw error;
  },

  async replaceDraftLines(receiptId: string, lines: PurchaseReceiptLineInput[]): Promise<void> {
    await ensureDraft(receiptId);
    if (!lines.length) throw new Error('ต้องมีอย่างน้อยหนึ่งรายการ');

    const { error: delErr } = await supabase
      .from('purchase_receipt_items')
      .delete()
      .eq('purchase_receipt_id', receiptId);
    if (delErr) throw delErr;

    const itemRows: PurchaseReceiptItemInsert[] = lines.map((line) => ({
      purchase_receipt_id: receiptId,
      product_id: line.product_id,
      quantity: line.quantity,
      unit: line.unit ?? null,
      unit_cost: line.unit_cost,
    }));

    const { error: insErr } = await supabase.from('purchase_receipt_items').insert(itemRows);
    if (insErr) throw insErr;
  },

  async cancelDraft(receiptId: string): Promise<void> {
    await ensureDraft(receiptId);
    const { error } = await supabase
      .from('purchase_receipts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', receiptId);
    if (error) throw error;
  },

  /**
   * โพสต์ใบรับ — อัปเดต moving average (ไม่ตัดสต็อก)
   */
  async postReceipt(receiptId: string): Promise<void> {
    const { error } = await supabase.rpc('post_purchase_receipt', { p_receipt_id: receiptId });
    if (error) throw error;
  },

  async listMovingAvgCosts(options?: { warehouseId?: string }): Promise<MovingAvgRow[]> {
    let q = supabase
      .from('product_moving_avg_costs')
      .select('*')
      .order('warehouse_id')
      .limit(2000);

    if (options?.warehouseId) q = q.eq('warehouse_id', options.warehouseId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as MovingAvgRow[];
  },
};
