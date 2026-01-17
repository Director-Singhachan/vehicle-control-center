import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];
type PayrollRecord = Database['public']['Tables']['payroll_records']['Row'];
type CommissionLog = Database['public']['Tables']['commission_logs']['Row'];

interface PayrollFormData {
  staff_id: string;
  period_month: number;
  period_year: number;
  base_salary: number;
  bonus: number;
  deductions: number;
}

export default function PayrollManagementView() {
  const [staff, setStaff] = useState<ServiceStaff[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [commissionLogs, setCommissionLogs] = useState<CommissionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState<PayrollFormData>({
    staff_id: '',
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
    base_salary: 0,
    bonus: 0,
    deductions: 0
  });

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      const [staffRes, payrollRes, commissionRes] = await Promise.all([
        supabase.from('service_staff').select('*').eq('status', 'active'),
        supabase.from('payroll_records').select('*')
          .eq('period_month', selectedMonth)
          .eq('period_year', selectedYear),
        supabase.from('commission_logs').select('*')
      ]);

      if (staffRes.error) throw staffRes.error;
      if (payrollRes.error) throw payrollRes.error;
      if (commissionRes.error) throw commissionRes.error;

      setStaff(staffRes.data || []);
      setPayrollRecords(payrollRes.data || []);
      setCommissionLogs(commissionRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCommissionForStaff = (staffId: string) => {
    return commissionLogs
      .filter(log => log.staff_id === staffId)
      .reduce((sum, log) => sum + (log.actual_commission || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.staff_id) {
      alert('กรุณาเลือกพนักงาน');
      return;
    }

    try {
      const commissionAmount = getCommissionForStaff(formData.staff_id);

      const { error } = await supabase
        .from('payroll_records')
        .insert([{
          staff_id: formData.staff_id,
          period_month: formData.period_month,
          period_year: formData.period_year,
          base_salary: formData.base_salary,
          commission_amount: commissionAmount,
          bonus: formData.bonus,
          deductions: formData.deductions,
          status: 'draft'
        }]);

      if (error) throw error;

      alert('บันทึกเงินเดือนสำเร็จ');
      setShowForm(false);
      setFormData({
        staff_id: '',
        period_month: selectedMonth,
        period_year: selectedYear,
        base_salary: 0,
        bonus: 0,
        deductions: 0
      });
      fetchData();
    } catch (error) {
      console.error('Error saving payroll:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handleApprovePayroll = async (payrollId: string) => {
    try {
      const { error } = await supabase
        .from('payroll_records')
        .update({ status: 'approved' })
        .eq('id', payrollId);

      if (error) throw error;
      alert('อนุมัติเงินเดือนสำเร็จ');
      fetchData();
    } catch (error) {
      console.error('Error approving payroll:', error);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handlePayPayroll = async (payrollId: string) => {
    try {
      const { error } = await supabase
        .from('payroll_records')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payrollId);

      if (error) throw error;
      alert('จ่ายเงินเดือนสำเร็จ');
      fetchData();
    } catch (error) {
      console.error('Error paying payroll:', error);
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
          <h1 className="text-3xl font-bold text-gray-900">จัดการเงินเดือน (Payroll)</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {showForm ? 'ยกเลิก' : 'บันทึกเงินเดือนใหม่'}
          </button>
        </div>

        {/* Month/Year Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2024, month - 1).toLocaleDateString('th-TH', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year + 543}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    พนักงาน *
                  </label>
                  <select
                    value={formData.staff_id}
                    onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">เลือกพนักงาน</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เงินเดือนฐาน
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base_salary}
                    onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    โบนัส
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.bonus}
                    onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หักเงิน
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
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

        {/* Payroll Summary */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              รายการเงินเดือน {new Date(2024, selectedMonth - 1).toLocaleDateString('th-TH', { month: 'long' })} {selectedYear + 543}
            </h2>
          </div>

          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ชื่อพนักงาน</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">เงินเดือนฐาน</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">คอมมิชชั่น</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">โบนัส</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">หักเงิน</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">สุทธิ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">สถานะ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payrollRecords.map((record) => {
                const staffName = staff.find(s => s.id === record.staff_id)?.name || '-';
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{staffName}</td>
                    <td className="px-6 py-3 text-sm text-right">{record.base_salary?.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-right">{record.commission_amount?.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-right">{record.bonus?.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-right">{record.deductions?.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold">
                      {record.net_payable?.toFixed(2)} บาท
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'paid' ? 'bg-green-100 text-green-800' :
                        record.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.status === 'paid' ? 'จ่ายแล้ว' :
                         record.status === 'approved' ? 'อนุมัติแล้ว' : 'ร่าง'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm space-x-2">
                      {record.status === 'draft' && (
                        <button
                          onClick={() => handleApprovePayroll(record.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          อนุมัติ
                        </button>
                      )}
                      {record.status === 'approved' && (
                        <button
                          onClick={() => handlePayPayroll(record.id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          จ่ายเงิน
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {payrollRecords.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              ไม่มีข้อมูลเงินเดือนสำหรับเดือนนี้
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
