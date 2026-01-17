import React, { useState, useEffect } from 'react';
import { supabase } from '../services';
import { Database } from '../types/database';

type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type JournalItem = Database['public']['Tables']['journal_items']['Row'];
type ChartOfAccount = Database['public']['Tables']['chart_of_accounts']['Row'];

interface JournalEntryForm {
  entry_date: string;
  reference_no: string;
  description: string;
  items: JournalItemForm[];
}

interface JournalItemForm {
  account_id: string;
  debit: number;
  credit: number;
  note: string;
}

export default function JournalEntriesView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [formData, setFormData] = useState<JournalEntryForm>({
    entry_date: new Date().toISOString().split('T')[0],
    reference_no: '',
    description: '',
    items: [
      { account_id: '', debit: 0, credit: 0, note: '' },
      { account_id: '', debit: 0, credit: 0, note: '' }
    ]
  });

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('code');
      
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { account_id: '', debit: 0, credit: 0, note: '' }]
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

  const calculateBalance = () => {
    const totalDebit = formData.items.reduce((sum, item) => sum + (item.debit || 0), 0);
    const totalCredit = formData.items.reduce((sum, item) => sum + (item.credit || 0), 0);
    return totalDebit - totalCredit;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate balance
    if (Math.abs(calculateBalance()) > 0.01) {
      alert('ยอดเดบิต และเครดิต ไม่สมดุล');
      return;
    }

    try {
      // Create journal entry
      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .insert([{
          entry_date: formData.entry_date,
          reference_no: formData.reference_no,
          description: formData.description,
          status: 'draft'
        }])
        .select()
        .single();

      if (entryError) throw entryError;

      // Create journal items
      const itemsToInsert = formData.items.map((item, index) => ({
        journal_entry_id: entryData.id,
        account_id: item.account_id,
        debit: item.debit,
        credit: item.credit,
        note: item.note,
        line_number: index + 1
      }));

      const { error: itemsError } = await supabase
        .from('journal_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      alert('บันทึกสมุดรายวันสำเร็จ');
      setShowForm(false);
      setFormData({
        entry_date: new Date().toISOString().split('T')[0],
        reference_no: '',
        description: '',
        items: [
          { account_id: '', debit: 0, credit: 0, note: '' },
          { account_id: '', debit: 0, credit: 0, note: '' }
        ]
      });
      fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handlePostEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update({ status: 'posted', posted_at: new Date().toISOString() })
        .eq('id', entryId);

      if (error) throw error;
      alert('บันทึกสมุดรายวันสำเร็จ');
      fetchEntries();
    } catch (error) {
      console.error('Error posting entry:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
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
          <h1 className="text-3xl font-bold text-gray-900">สมุดรายวัน (Journal Entries)</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {showForm ? 'ยกเลิก' : 'บันทึกรายการใหม่'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่บันทึก
                  </label>
                  <input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เลขที่อ้างอิง
                  </label>
                  <input
                    type="text"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="เช่น INV-001"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="อธิบายรายการบัญชี"
                />
              </div>

              {/* Items Table */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-3">รายการบัญชี</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">บัญชี</th>
                        <th className="px-4 py-2 text-right">เดบิต</th>
                        <th className="px-4 py-2 text-right">เครดิต</th>
                        <th className="px-4 py-2 text-left">หมายเหตุ</th>
                        <th className="px-4 py-2">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="px-4 py-2">
                            <select
                              value={item.account_id}
                              onChange={(e) => handleItemChange(index, 'account_id', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                              required
                            >
                              <option value="">เลือกบัญชี</option>
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.debit}
                              onChange={(e) => handleItemChange(index, 'debit', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.credit}
                              onChange={(e) => handleItemChange(index, 'credit', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.note}
                              onChange={(e) => handleItemChange(index, 'note', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
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
                      ))}
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
                  <div className={`text-lg font-semibold ${Math.abs(calculateBalance()) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                    ยอดคงเหลือ: {calculateBalance().toFixed(2)}
                  </div>
                </div>
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

        {/* Entries List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">วันที่</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">เลขที่อ้างอิง</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">รายละเอียด</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">สถานะ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {new Date(entry.entry_date).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">{entry.reference_no}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{entry.description}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.status === 'posted' ? 'bg-green-100 text-green-800' :
                      entry.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {entry.status === 'posted' ? 'บันทึกแล้ว' :
                       entry.status === 'draft' ? 'ร่าง' : 'ยกเลิก'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {entry.status === 'draft' && (
                      <button
                        onClick={() => handlePostEntry(entry.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        บันทึก
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
