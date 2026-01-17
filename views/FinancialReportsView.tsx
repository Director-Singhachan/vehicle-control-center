import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type TrialBalance = {
  code: string;
  name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type AccountsReceivable = {
  customer_id: string;
  full_name: string;
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
  outstanding_amount: number;
  last_invoice_date: string;
};

export default function FinancialReportsView() {
  const [reportType, setReportType] = useState<'trial_balance' | 'ar_summary' | 'expense_summary'>('trial_balance');
  const [trialBalance, setTrialBalance] = useState<TrialBalance[]>([]);
  const [arSummary, setARSummary] = useState<AccountsReceivable[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchReportData();
  }, [reportType, dateFrom, dateTo]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'trial_balance') {
        const { data, error } = await supabase
          .from('trial_balance')
          .select('*');
        
        if (error) throw error;
        setTrialBalance(data || []);
      } else if (reportType === 'ar_summary') {
        const { data, error } = await supabase
          .from('accounts_receivable_summary')
          .select('*');
        
        if (error) throw error;
        setARSummary(data || []);
      } else if (reportType === 'expense_summary') {
        const { data, error } = await supabase
          .from('expense_records')
          .select('*')
          .gte('expense_date', dateFrom)
          .lte('expense_date', dateTo);
        
        if (error) throw error;
        setExpenses(data || []);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (data: TrialBalance[]) => {
    return {
      totalDebit: data.reduce((sum, row) => sum + row.total_debit, 0),
      totalCredit: data.reduce((sum, row) => sum + (row.total_credit || 0), 0)
    };
  };

  const calculateARTotals = (data: AccountsReceivable[]) => {
    return {
      totalInvoiced: data.reduce((sum, row) => sum + row.total_invoiced, 0),
      totalPaid: data.reduce((sum, row) => sum + row.total_paid, 0),
      totalOutstanding: data.reduce((sum, row) => sum + row.outstanding_amount, 0)
    };
  };

  const calculateExpenseTotals = (data: any[]) => {
    return data.reduce((sum, row) => sum + (row.amount || 0), 0);
  };

  const groupExpensesByType = (data: any[]) => {
    const grouped: { [key: string]: number } = {};
    data.forEach(expense => {
      grouped[expense.expense_type] = (grouped[expense.expense_type] || 0) + (expense.amount || 0);
    });
    return grouped;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">กำลังโหลด...</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">รายงานการเงิน (Financial Reports)</h1>

        {/* Report Type Selection */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setReportType('trial_balance')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportType === 'trial_balance'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ยอดทดลอง (Trial Balance)
            </button>
            <button
              onClick={() => setReportType('ar_summary')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportType === 'ar_summary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ลูกหนี้ (A/R Summary)
            </button>
            <button
              onClick={() => setReportType('expense_summary')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                reportType === 'expense_summary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ค่าใช้จ่าย (Expenses)
            </button>
          </div>

          {/* Date Range Filter */}
          {reportType === 'expense_summary' && (
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จากวันที่</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Trial Balance Report */}
        {reportType === 'trial_balance' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">ยอดทดลอง (Trial Balance)</h2>
            </div>

            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">รหัสบัญชี</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ชื่อบัญชี</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ประเภท</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">เดบิต</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">เครดิต</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">ยอดคงเหลือ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trialBalance.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.code}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.account_type}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {row.total_debit?.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {row.total_credit?.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold">
                      {row.balance?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t font-semibold">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-sm">รวม</td>
                  <td className="px-6 py-3 text-sm text-right">
                    {calculateTotals(trialBalance).totalDebit.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right">
                    {calculateTotals(trialBalance).totalCredit.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right">
                    {(calculateTotals(trialBalance).totalDebit - calculateTotals(trialBalance).totalCredit).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Accounts Receivable Report */}
        {reportType === 'ar_summary' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">สรุปลูกหนี้ (Accounts Receivable)</h2>
            </div>

            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ชื่อลูกค้า</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">จำนวนใบแจ้งหนี้</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">ยอดแจ้งหนี้</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">ยอดชำระแล้ว</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">ยอดคงค้าง</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ใบแจ้งหนี้ล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {arSummary.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{row.full_name || 'ไม่ระบุ'}</td>
                    <td className="px-6 py-3 text-sm text-right">{row.invoice_count}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {row.total_invoiced?.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {row.total_paid?.toFixed(2)}
                    </td>
                    <td className={`px-6 py-3 text-sm text-right font-semibold ${
                      row.outstanding_amount > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {row.outstanding_amount?.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {row.last_invoice_date ? new Date(row.last_invoice_date).toLocaleDateString('th-TH') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t font-semibold">
                <tr>
                  <td className="px-6 py-3 text-sm">รวม</td>
                  <td className="px-6 py-3 text-sm text-right">
                    {arSummary.reduce((sum, row) => sum + row.invoice_count, 0)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right">
                    {calculateARTotals(arSummary).totalInvoiced.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right">
                    {calculateARTotals(arSummary).totalPaid.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right">
                    {calculateARTotals(arSummary).totalOutstanding.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Expense Summary Report */}
        {reportType === 'expense_summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary Cards */}
            <div className="lg:col-span-3 grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-4">
                <p className="text-gray-600 text-sm">ค่าใช้จ่ายทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculateExpenseTotals(expenses).toFixed(2)} บาท
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <p className="text-gray-600 text-sm">จำนวนรายการ</p>
                <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <p className="text-gray-600 text-sm">ค่าใช้จ่ายเฉลี่ย</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(calculateExpenseTotals(expenses) / (expenses.length || 1)).toFixed(2)} บาท
                </p>
              </div>
            </div>

            {/* Expense by Type */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">ค่าใช้จ่ายตามประเภท</h3>
              <div className="space-y-3">
                {Object.entries(groupExpensesByType(expenses)).map(([type, amount]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700">{type}</span>
                    <span className="font-semibold text-gray-900">{(amount as number).toFixed(2)} บาท</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense List */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">รายละเอียดค่าใช้จ่าย</h3>
              </div>

              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">วันที่</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ประเภท</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">รายละเอียด</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">จำนวน</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((expense, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {new Date(expense.expense_date).toLocaleDateString('th-TH')}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{expense.expense_type}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{expense.description}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">
                        {expense.amount?.toFixed(2)} บาท
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
