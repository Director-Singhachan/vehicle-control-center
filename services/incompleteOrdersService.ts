import { supabase } from '../lib/supabase';

export interface IncompleteOrderItem {
  product_id?: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

export interface IncompleteOrder {
  id: string;
  doc_no: string;
  order_date: string;
  customer_name: string;
  customer_code: string;
  net_value: number;
  items: IncompleteOrderItem[];
  error_message: string;
  status: 'pending' | 'resolved' | 'deleted';
  warehouse_id: string | null;
  branch: string | null;
  created_at: string;
  created_by: string | null;
}

export const incompleteOrdersService = {
  async getAll() {
    const { data, error } = await supabase
      .from('incomplete_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as IncompleteOrder[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('incomplete_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as IncompleteOrder;
  },

  async create(order: Omit<IncompleteOrder, 'id' | 'created_at' | 'status'>) {
    const { data, error } = await supabase
      .from('incomplete_orders')
      .insert([order])
      .select()
      .single();

    if (error) throw error;
    return data as IncompleteOrder;
  },

  async update(id: string, updates: Partial<IncompleteOrder>) {
    const { data, error } = await supabase
      .from('incomplete_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as IncompleteOrder;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('incomplete_orders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async resolve(id: string) {
    return this.update(id, { status: 'resolved' });
  }
};
