import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface POItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface POFormData {
  supplier_id: string;
  warehouse_id: string;
  order_date: string;
  expected_delivery: string;
  items: POItem[];
  notes: string;
}

export default function PurchaseOrdersView() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<POFormData>({
    supplier_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    items: [{ product_id: '', quantity: 0, unit_price: 0 }],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('order_date', { ascending: false }),
        supabase.from('suppliers').select('*').eq('is_active', true),
        supabase.from('products').select('*').eq('is_active', true)
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (productsRes.error) throw productsRes.error;

      setOrders(ordersRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 0, unit_price: 0 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      alert('กรุณาเลือกผู้ขาย');
      return;
    }

    if (formData.items.some(item => !item.product_id || item.quantity === 0)) {
      alert('กรุณากรอกข้อมูลรายการให้ครบถ้วน');
      return;
    }

    try {
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          supplier_id: formData.supplier_id,
          warehouse_id: formData.warehouse_id || null,
          order_date: formData.order_date,
          expected_delivery: formData.expected_delivery || null,
          total_amount: calculateTotal(),
          status: 'draft',
          notes: formData.notes
        }])
        .select()
        .single();

      if (poError) throw poError;

      // Insert items
      const itemsToInsert = formData.items.map(item => ({
        po_id: poData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      alert('สร้างใบสั่งซื้อสำเร็จ');
      setShowForm(false);
      setFormData({
        supplier_id: '',
        warehouse_id: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: '',
        items: [{ product_id: '', quantity: 0, unit_price: 0 }],
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error saving PO:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handleApprovePO = async (poId: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'approved' })
        .eq('id', poId);

      if (error) throw error;
      alert('อนุมัติใบสั่งซื้อสำเร็จ');
      fetchData();
    } catch (error) {
      console.error('Error approving PO:', error);
      alert('เกิดข้อผิดพลาด');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">กำลังโหลด...</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">ใบสั่งซื้อ (Purchase Orders)</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {showForm ? 'ยกเลิก' : 'สร้างใบสั่งซื้อใหม่'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ผู้ขาย *
                  </label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">เลือกผู้ขาย</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่สั่งซื้อ
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่คาดว่าจะได้รับ
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery}
                  onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Items Table */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-3">รายการสินค้า</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">สินค้า</th>
                        <th className="px-4 py-2 text-right">จำนวน</th>
                        <th className="px-4 py-2 text-right">ราคาต่อหน่วย</th>
                        <th className="px-4 py-2 text-right">รวม</th>
                        <th className="px-4 py-2">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => {
                        const subtotal = item.quantity * item.unit_price;
                        return (
                          <tr key={index} className="border-b">
                            <td className="px-4 py-2">
                              <select
                                value={item.product_id}
                                onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                                required
                              >
                                <option value="">เลือกสินค้า</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.product_name} ({product.unit})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {subtotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + เพิ่มรายการ
                  </button>
                  <div className="text-lg font-semibold">
                    รวมทั้งสิ้น: {calculateTotal().toFixed(2)} บาท
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">เลขที่ PO</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ผู้ขาย</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">วันที่สั่ง</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">ยอดรวม</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">สถานะ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const supplier = suppliers.find(s => s.id === order.supplier_id);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{order.po_number}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{supplier?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(order.order_date).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {order.total_amount?.toFixed(2)} บาท
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'approved' ? 'bg-green-100 text-green-800' :
                        order.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'received' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status === 'approved' ? 'อนุมัติแล้ว' :
                         order.status === 'draft' ? 'ร่าง' :
                         order.status === 'received' ? 'ได้รับแล้ว' : order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {order.status === 'draft' && (
                        <button
                          onClick={() => handleApprovePO(order.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          อนุมัติ
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
