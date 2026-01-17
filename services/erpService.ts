import { supabase } from './index';

/**
 * ERP Service - Handles all ERP-related operations
 */

// ============================================================
// FINANCIAL MANAGEMENT
// ============================================================

export const financialService = {
  /**
   * Create a journal entry with items
   */
  async createJournalEntry(
    entryDate: string,
    referenceNo: string,
    description: string,
    items: Array<{
      accountId: string;
      debit: number;
      credit: number;
      note?: string;
    }>
  ) {
    try {
      // Validate balance
      const totalDebit = items.reduce((sum, item) => sum + item.debit, 0);
      const totalCredit = items.reduce((sum, item) => sum + item.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Debit and credit amounts do not balance');
      }

      // Create journal entry
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert([
          {
            entry_date: entryDate,
            reference_no: referenceNo,
            description,
            status: 'draft',
          },
        ])
        .select()
        .single();

      if (entryError) throw entryError;

      // Create journal items
      const itemsToInsert = items.map((item, index) => ({
        journal_entry_id: entry.id,
        account_id: item.accountId,
        debit: item.debit,
        credit: item.credit,
        note: item.note,
        line_number: index + 1,
      }));

      const { error: itemsError } = await supabase
        .from('journal_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return { success: true, entryId: entry.id };
    } catch (error) {
      console.error('Error creating journal entry:', error);
      throw error;
    }
  },

  /**
   * Post a journal entry to the ledger
   */
  async postJournalEntry(entryId: string) {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error posting journal entry:', error);
      throw error;
    }
  },

  /**
   * Get trial balance
   */
  async getTrialBalance() {
    try {
      const { data, error } = await supabase
        .from('trial_balance')
        .select('*');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching trial balance:', error);
      throw error;
    }
  },

  /**
   * Get accounts receivable summary
   */
  async getAccountsReceivable() {
    try {
      const { data, error } = await supabase
        .from('accounts_receivable_summary')
        .select('*');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching AR summary:', error);
      throw error;
    }
  },

  /**
   * Record a payment for an invoice
   */
  async recordPayment(invoiceId: string, amount: number, paymentMethod: string) {
    try {
      // Get invoice details
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, total_amount, paid_amount')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payment_records')
        .insert([
          {
            invoice_id: invoiceId,
            payment_date: new Date().toISOString().split('T')[0],
            amount,
            payment_method: paymentMethod,
          },
        ]);

      if (paymentError) throw paymentError;

      // Update invoice
      const newPaidAmount = (invoice.paid_amount || 0) + amount;
      const totalAmount = invoice.total_amount || 0;

      let newStatus = 'unpaid';
      if (newPaidAmount >= totalAmount) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      return { success: true, newStatus, newPaidAmount };
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  },
};

// ============================================================
// PURCHASE MANAGEMENT
// ============================================================

export const purchaseService = {
  /**
   * Create a purchase order
   */
  async createPurchaseOrder(
    supplierId: string,
    warehouseId: string | null,
    orderDate: string,
    expectedDelivery: string | null,
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
    notes?: string
  ) {
    try {
      // Calculate total
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );

      // Create PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([
          {
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            order_date: orderDate,
            expected_delivery: expectedDelivery,
            total_amount: totalAmount,
            status: 'draft',
            notes,
          },
        ])
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items
      const itemsToInsert = items.map((item) => ({
        po_id: po.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return { success: true, poId: po.id };
    } catch (error) {
      console.error('Error creating PO:', error);
      throw error;
    }
  },

  /**
   * Approve a purchase order
   */
  async approvePurchaseOrder(poId: string) {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'approved' })
        .eq('id', poId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error approving PO:', error);
      throw error;
    }
  },

  /**
   * Record goods receipt
   */
  async recordGoodsReceipt(
    poId: string,
    warehouseId: string,
    items: Array<{
      poItemId: string;
      quantityReceived: number;
      qualityStatus: string;
    }>
  ) {
    try {
      // Create goods receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('goods_receipts')
        .insert([
          {
            po_id: poId,
            warehouse_id: warehouseId,
            receipt_date: new Date().toISOString().split('T')[0],
            status: 'completed',
          },
        ])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create receipt items
      const itemsToInsert = items.map((item) => ({
        receipt_id: receipt.id,
        po_item_id: item.poItemId,
        quantity_received: item.quantityReceived,
        quality_status: item.qualityStatus,
      }));

      const { error: itemsError } = await supabase
        .from('goods_receipt_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update PO status
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', poId);

      if (poError) throw poError;

      return { success: true, receiptId: receipt.id };
    } catch (error) {
      console.error('Error recording goods receipt:', error);
      throw error;
    }
  },

  /**
   * Get accounts payable summary
   */
  async getAccountsPayable() {
    try {
      const { data, error } = await supabase
        .from('accounts_payable_summary')
        .select('*');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching AP summary:', error);
      throw error;
    }
  },
};

// ============================================================
// HR MANAGEMENT
// ============================================================

export const hrService = {
  /**
   * Create or update employee details
   */
  async updateEmployeeDetails(
    staffId: string,
    details: {
      idCardNo?: string;
      birthDate?: string;
      joinDate?: string;
      salary?: number;
      bankAccountNo?: string;
      bankName?: string;
      emergencyContact?: string;
      address?: string;
    }
  ) {
    try {
      const { error } = await supabase
        .from('employee_details')
        .upsert(
          [
            {
              id: staffId,
              id_card_no: details.idCardNo,
              birth_date: details.birthDate,
              join_date: details.joinDate,
              salary: details.salary,
              bank_account_no: details.bankAccountNo,
              bank_name: details.bankName,
              emergency_contact: details.emergencyContact,
              address: details.address,
            },
          ],
          { onConflict: 'id' }
        );

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating employee details:', error);
      throw error;
    }
  },

  /**
   * Create a leave request
   */
  async createLeaveRequest(
    staffId: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason?: string
  ) {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert([
          {
            staff_id: staffId,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  },

  /**
   * Approve a leave request
   */
  async approveLeaveRequest(leaveId: string, approverId: string) {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', leaveId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error approving leave request:', error);
      throw error;
    }
  },

  /**
   * Record attendance
   */
  async recordAttendance(
    staffId: string,
    attendanceDate: string,
    checkInTime?: string,
    checkOutTime?: string,
    status?: string
  ) {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert(
          [
            {
              staff_id: staffId,
              attendance_date: attendanceDate,
              check_in_time: checkInTime,
              check_out_time: checkOutTime,
              status: status || 'present',
            },
          ],
          { onConflict: 'staff_id,attendance_date' }
        );

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error recording attendance:', error);
      throw error;
    }
  },

  /**
   * Create a payroll record
   */
  async createPayrollRecord(
    staffId: string,
    periodMonth: number,
    periodYear: number,
    baseSalary: number,
    commissionAmount: number = 0,
    bonus: number = 0,
    deductions: number = 0
  ) {
    try {
      const { error } = await supabase
        .from('payroll_records')
        .insert([
          {
            staff_id: staffId,
            period_month: periodMonth,
            period_year: periodYear,
            base_salary: baseSalary,
            commission_amount: commissionAmount,
            bonus,
            deductions,
            status: 'draft',
          },
        ]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error creating payroll record:', error);
      throw error;
    }
  },

  /**
   * Approve payroll
   */
  async approvePayroll(payrollId: string) {
    try {
      const { error } = await supabase
        .from('payroll_records')
        .update({ status: 'approved' })
        .eq('id', payrollId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error approving payroll:', error);
      throw error;
    }
  },

  /**
   * Pay payroll
   */
  async payPayroll(payrollId: string) {
    try {
      const { error } = await supabase
        .from('payroll_records')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payrollId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error paying payroll:', error);
      throw error;
    }
  },

  /**
   * Get leave balance
   */
  async getLeaveBalance(staffId: string) {
    try {
      const { data, error } = await supabase
        .from('leave_balance')
        .select('*')
        .eq('id', staffId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      throw error;
    }
  },

  /**
   * Get employee summary
   */
  async getEmployeeSummary(staffId: string) {
    try {
      const { data, error } = await supabase
        .from('employee_summary')
        .select('*')
        .eq('id', staffId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching employee summary:', error);
      throw error;
    }
  },
};

export default {
  financial: financialService,
  purchase: purchaseService,
  hr: hrService,
};
