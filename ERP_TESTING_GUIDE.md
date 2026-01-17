# ERP Testing Guide

## Overview

This guide provides comprehensive testing procedures for the ERP modules to ensure all features work correctly and securely.

---

## 1. Database Migration Testing

### Step 1: Verify Migrations Applied

```bash
# Check migration status
supabase migration list

# Expected output: All three migrations should show as applied
# - 20260201010000_create_financial_management_module
# - 20260201020000_create_purchase_management_module
# - 20260201030000_create_hr_management_module
```

### Step 2: Verify Table Creation

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'chart_of_accounts',
  'journal_entries',
  'journal_items',
  'invoices',
  'payment_records',
  'expense_records',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'goods_receipts',
  'goods_receipt_items',
  'supplier_invoices',
  'supplier_payments',
  'employee_details',
  'leave_requests',
  'attendance_records',
  'payroll_records',
  'payroll_deductions',
  'allowances',
  'employee_performance'
)
ORDER BY table_name;

-- Expected: 20 tables
```

### Step 3: Verify Views Creation

```sql
-- Check all views exist
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
  'trial_balance',
  'account_ledger',
  'accounts_receivable_summary',
  'accounts_payable_summary',
  'employee_summary',
  'payroll_summary',
  'leave_balance'
)
ORDER BY table_name;

-- Expected: 7 views
```

### Step 4: Verify RLS Enabled

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'chart_of_accounts',
  'journal_entries',
  'invoices',
  'purchase_orders',
  'employee_details',
  'payroll_records'
)
ORDER BY tablename;

-- Expected: All should have rowsecurity = true
```

---

## 2. Financial Management Testing

### Test 2.1: Chart of Accounts

**Objective**: Verify chart of accounts can be created and retrieved

```sql
-- Insert sample accounts
INSERT INTO chart_of_accounts (code, name, account_type, is_active)
VALUES
  ('110100', 'Cash', 'asset', true),
  ('110200', 'Bank Account', 'asset', true),
  ('120100', 'Accounts Receivable', 'asset', true),
  ('210100', 'Accounts Payable', 'liability', true),
  ('310100', 'Capital', 'equity', true),
  ('410100', 'Sales Revenue', 'revenue', true),
  ('510100', 'Fuel Expense', 'expense', true),
  ('510200', 'Maintenance Expense', 'expense', true),
  ('510300', 'Salary Expense', 'expense', true);

-- Verify retrieval
SELECT code, name, account_type FROM chart_of_accounts
WHERE is_active = true
ORDER BY code;

-- Expected: 9 rows with correct data
```

### Test 2.2: Journal Entry Creation with Balance Validation

**Objective**: Verify journal entries balance correctly

```sql
-- Create a balanced journal entry
INSERT INTO journal_entries (entry_date, reference_no, description, status)
VALUES ('2026-02-01', 'JE-001', 'Opening balance', 'draft')
RETURNING id;

-- Get the entry ID from above and use it in the next queries

-- Insert journal items (must balance)
INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, line_number)
VALUES
  ('ENTRY_ID_HERE', (SELECT id FROM chart_of_accounts WHERE code = '110100'), 10000, 0, 1),
  ('ENTRY_ID_HERE', (SELECT id FROM chart_of_accounts WHERE code = '310100'), 0, 10000, 2);

-- Verify balance
SELECT
  SUM(debit) as total_debit,
  SUM(credit) as total_credit,
  SUM(debit) - SUM(credit) as balance
FROM journal_items
WHERE journal_entry_id = 'ENTRY_ID_HERE';

-- Expected: total_debit = 10000, total_credit = 10000, balance = 0
```

### Test 2.3: Trial Balance Report

**Objective**: Verify trial balance calculates correctly

```sql
-- Post the journal entry
UPDATE journal_entries
SET status = 'posted', posted_at = now()
WHERE id = 'ENTRY_ID_HERE';

-- Query trial balance view
SELECT code, name, account_type, total_debit, total_credit, balance
FROM trial_balance
ORDER BY code;

-- Expected: Balanced debit and credit totals
```

### Test 2.4: Invoice and Payment Recording

**Objective**: Verify invoices and payments work correctly

```sql
-- Create an invoice
INSERT INTO invoices (invoice_no, customer_id, issue_date, due_date, total_amount, status)
VALUES ('INV-001', 'CUSTOMER_ID', '2026-02-01', '2026-02-15', 5000, 'unpaid')
RETURNING id;

-- Record partial payment
INSERT INTO payment_records (invoice_id, payment_date, amount, payment_method)
VALUES ('INVOICE_ID', '2026-02-05', 2000, 'bank_transfer');

-- Verify invoice status updated
SELECT id, invoice_no, total_amount, paid_amount, status
FROM invoices
WHERE id = 'INVOICE_ID';

-- Expected: paid_amount = 2000, status = 'partial'
```

---

## 3. Purchase Management Testing

### Test 3.1: Supplier Management

**Objective**: Verify suppliers can be created and retrieved

```sql
-- Create a supplier
INSERT INTO suppliers (name, tax_id, contact_name, phone, email, payment_terms, is_active)
VALUES ('ABC Supplier', 'TAX123456', 'John Doe', '0812345678', 'john@abc.com', 'Net 30', true)
RETURNING id;

-- Verify retrieval
SELECT name, tax_id, contact_name, payment_terms
FROM suppliers
WHERE is_active = true;

-- Expected: Supplier record visible
```

### Test 3.2: Purchase Order Creation

**Objective**: Verify PO creation with items

```sql
-- Create a purchase order
INSERT INTO purchase_orders (supplier_id, order_date, expected_delivery, total_amount, status)
VALUES (
  'SUPPLIER_ID',
  '2026-02-01',
  '2026-02-10',
  5000,
  'draft'
)
RETURNING id;

-- Add PO items
INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_price, subtotal)
VALUES
  ('PO_ID', 'PRODUCT_ID_1', 10, 250, 2500),
  ('PO_ID', 'PRODUCT_ID_2', 10, 250, 2500);

-- Verify PO
SELECT po_number, total_amount, status
FROM purchase_orders
WHERE id = 'PO_ID';

-- Expected: PO created with total_amount = 5000
```

### Test 3.3: Goods Receipt

**Objective**: Verify goods receipt recording

```sql
-- Create goods receipt
INSERT INTO goods_receipts (po_id, warehouse_id, receipt_date, status)
VALUES ('PO_ID', 'WAREHOUSE_ID', '2026-02-10', 'completed')
RETURNING id;

-- Add receipt items
INSERT INTO goods_receipt_items (receipt_id, po_item_id, quantity_received, quality_status)
VALUES
  ('RECEIPT_ID', 'PO_ITEM_ID_1', 10, 'good'),
  ('RECEIPT_ID', 'PO_ITEM_ID_2', 10, 'good');

-- Verify PO status updated
SELECT status FROM purchase_orders WHERE id = 'PO_ID';

-- Expected: status = 'received'
```

---

## 4. HR Management Testing

### Test 4.1: Employee Details

**Objective**: Verify employee details can be created and updated

```sql
-- Create employee details
INSERT INTO employee_details (
  id, id_card_no, birth_date, join_date, salary,
  bank_account_no, bank_name, emergency_contact, address
)
VALUES (
  'STAFF_ID',
  '1234567890123',
  '1990-01-15',
  '2020-01-01',
  25000,
  '1234567890',
  'Thai Bank',
  'Jane Doe',
  '123 Main St'
)
ON CONFLICT (id) DO UPDATE SET
  salary = EXCLUDED.salary,
  updated_at = now();

-- Verify
SELECT id, id_card_no, salary, bank_name
FROM employee_details
WHERE id = 'STAFF_ID';

-- Expected: Employee details visible
```

### Test 4.2: Leave Request Workflow

**Objective**: Verify leave request creation and approval

```sql
-- Create leave request
INSERT INTO leave_requests (
  staff_id, leave_type, start_date, end_date, reason, status
)
VALUES (
  'STAFF_ID',
  'annual',
  '2026-02-10',
  '2026-02-12',
  'Vacation',
  'pending'
)
RETURNING id;

-- Verify pending status
SELECT id, leave_type, status, number_of_days
FROM leave_requests
WHERE id = 'LEAVE_ID';

-- Expected: status = 'pending', number_of_days = 3

-- Approve leave request
UPDATE leave_requests
SET status = 'approved', approved_by = 'MANAGER_ID', approved_at = now()
WHERE id = 'LEAVE_ID';

-- Verify approved
SELECT status, approved_by FROM leave_requests WHERE id = 'LEAVE_ID';

-- Expected: status = 'approved'
```

### Test 4.3: Attendance Recording

**Objective**: Verify attendance can be recorded

```sql
-- Record attendance
INSERT INTO attendance_records (
  staff_id, attendance_date, check_in_time, check_out_time, status
)
VALUES (
  'STAFF_ID',
  '2026-02-01',
  '2026-02-01 08:00:00+07',
  '2026-02-01 17:00:00+07',
  'present'
)
ON CONFLICT (staff_id, attendance_date) DO UPDATE SET
  check_in_time = EXCLUDED.check_in_time,
  check_out_time = EXCLUDED.check_out_time;

-- Verify
SELECT attendance_date, status FROM attendance_records
WHERE staff_id = 'STAFF_ID'
ORDER BY attendance_date DESC;

-- Expected: Attendance record visible
```

### Test 4.4: Payroll Creation and Approval

**Objective**: Verify payroll workflow

```sql
-- Create payroll record
INSERT INTO payroll_records (
  staff_id, period_month, period_year,
  base_salary, commission_amount, bonus, deductions, status
)
VALUES (
  'STAFF_ID',
  2,
  2026,
  25000,
  5000,
  0,
  0,
  'draft'
)
RETURNING id;

-- Verify draft status
SELECT id, base_salary, commission_amount, net_payable, status
FROM payroll_records
WHERE id = 'PAYROLL_ID';

-- Expected: status = 'draft', net_payable = 30000

-- Approve payroll
UPDATE payroll_records
SET status = 'approved'
WHERE id = 'PAYROLL_ID';

-- Pay payroll
UPDATE payroll_records
SET status = 'paid', paid_at = now()
WHERE id = 'PAYROLL_ID';

-- Verify
SELECT status, paid_at FROM payroll_records WHERE id = 'PAYROLL_ID';

-- Expected: status = 'paid'
```

---

## 5. RLS (Row Level Security) Testing

### Test 5.1: Admin Access

**Objective**: Verify admin can access all data

```sql
-- As admin user
SET ROLE admin;

SELECT COUNT(*) FROM journal_entries;
SELECT COUNT(*) FROM purchase_orders;
SELECT COUNT(*) FROM payroll_records;

-- Expected: All queries return results
```

### Test 5.2: Manager Access

**Objective**: Verify manager can create and manage records

```sql
-- As manager user
SET ROLE manager;

-- Can create journal entry
INSERT INTO journal_entries (entry_date, reference_no, description, status)
VALUES ('2026-02-01', 'JE-TEST', 'Test', 'draft');

-- Can view all payroll
SELECT COUNT(*) FROM payroll_records;

-- Expected: Operations succeed
```

### Test 5.3: Employee Access

**Objective**: Verify employee can only see own data

```sql
-- As employee (driver) user
SET ROLE driver;

-- Can see own payroll
SELECT COUNT(*) FROM payroll_records WHERE staff_id = auth.uid();

-- Cannot see other employees' payroll
SELECT COUNT(*) FROM payroll_records WHERE staff_id != auth.uid();

-- Expected: First query returns results, second returns 0
```

### Test 5.4: Permission Denied

**Objective**: Verify unauthorized access is blocked

```sql
-- As driver user
SET ROLE driver;

-- Try to create journal entry (should fail)
INSERT INTO journal_entries (entry_date, reference_no, description, status)
VALUES ('2026-02-01', 'JE-FAIL', 'Test', 'draft');

-- Expected: Permission denied error
```

---

## 6. Edge Function Testing

### Test 6.1: Calculate Payroll Function

**Objective**: Verify payroll calculation function

```bash
# Call the Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/calculate-payroll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": "STAFF_ID",
    "period_month": 2,
    "period_year": 2026
  }'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "payroll_id": "...",
#     "base_salary": 25000,
#     "commission_amount": 5000,
#     "allowance_amount": 1000,
#     "total": 31000
#   }
# }
```

### Test 6.2: Generate PO Number Function

**Objective**: Verify PO number generation

```bash
# Call the Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/generate-po-number \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response:
# {
#   "success": true,
#   "po_number": "PO-202602-0001"
# }
```

---

## 7. React Component Testing

### Test 7.1: Journal Entries View

**Objective**: Verify journal entries component loads and works

```tsx
// In your test file
import { render, screen, fireEvent } from '@testing-library/react';
import JournalEntriesView from './views/JournalEntriesView';

test('Journal Entries View renders', () => {
  render(<JournalEntriesView />);
  expect(screen.getByText('สมุดรายวัน')).toBeInTheDocument();
});

test('Can add journal entry items', () => {
  render(<JournalEntriesView />);
  const addButton = screen.getByText('+ เพิ่มรายการ');
  fireEvent.click(addButton);
  // Verify new item row appears
});
```

### Test 7.2: Purchase Orders View

**Objective**: Verify purchase orders component

```tsx
test('Purchase Orders View renders', () => {
  render(<PurchaseOrdersView />);
  expect(screen.getByText('ใบสั่งซื้อ')).toBeInTheDocument();
});

test('Can calculate PO total', () => {
  render(<PurchaseOrdersView />);
  // Add items and verify total calculation
});
```

### Test 7.3: Payroll Management View

**Objective**: Verify payroll component

```tsx
test('Payroll Management View renders', () => {
  render(<PayrollManagementView />);
  expect(screen.getByText('จัดการเงินเดือน')).toBeInTheDocument();
});

test('Can filter by month/year', () => {
  render(<PayrollManagementView />);
  // Change month/year and verify data updates
});
```

---

## 8. Performance Testing

### Test 8.1: Large Dataset Query

**Objective**: Verify system handles large datasets

```sql
-- Create 1000 journal entries
INSERT INTO journal_entries (entry_date, reference_no, description, status)
SELECT
  CURRENT_DATE - (random() * 365)::integer,
  'JE-' || generate_series(1, 1000),
  'Test entry',
  'posted';

-- Query performance
EXPLAIN ANALYZE
SELECT * FROM trial_balance;

-- Expected: Query completes in < 1 second
```

### Test 8.2: Concurrent Access

**Objective**: Verify system handles concurrent users

```bash
# Use Apache Bench or similar
ab -n 100 -c 10 https://your-app/financial/journal-entries

# Expected: All requests succeed with < 500ms response time
```

---

## 9. Security Testing

### Test 9.1: SQL Injection Prevention

**Objective**: Verify parameterized queries prevent injection

```tsx
// Attempt SQL injection in form
const maliciousInput = "'; DROP TABLE journal_entries; --";

// Should be safely escaped and not execute
await financialService.createJournalEntry(
  '2026-02-01',
  maliciousInput,
  'Test',
  []
);

// Expected: Entry created with malicious string as data, no table dropped
```

### Test 9.2: XSS Prevention

**Objective**: Verify XSS attacks are prevented

```tsx
// Attempt XSS in form
const xssPayload = "<img src=x onerror='alert(1)'>";

// Should be escaped when rendered
render(<JournalEntriesView />);
// Enter xssPayload in description field

// Expected: Payload displayed as text, not executed
```

---

## 10. Checklist

- [ ] All migrations applied successfully
- [ ] All tables created with correct schema
- [ ] All views created and working
- [ ] RLS enabled on all sensitive tables
- [ ] Journal entries balance correctly
- [ ] Trial balance calculates correctly
- [ ] Purchase orders can be created and approved
- [ ] Goods receipts update inventory
- [ ] Employee details can be created/updated
- [ ] Leave requests workflow works
- [ ] Payroll calculates with commissions
- [ ] Admin can access all data
- [ ] Managers can create and manage records
- [ ] Employees can only see own data
- [ ] Edge Functions execute correctly
- [ ] React components render and function
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Performance acceptable
- [ ] Concurrent access works

---

## Troubleshooting

### Issue: "Permission denied" on SELECT

**Solution**: Check user role and RLS policies

```sql
SELECT role FROM profiles WHERE id = auth.uid();
SELECT * FROM pg_policies WHERE tablename = 'journal_entries';
```

### Issue: Journal entry won't post

**Solution**: Verify debit/credit balance

```sql
SELECT SUM(debit), SUM(credit) FROM journal_items WHERE journal_entry_id = 'ID';
```

### Issue: PO number not generating

**Solution**: Check Edge Function logs

```bash
supabase functions list
supabase functions logs generate-po-number
```

---

**Last Updated**: February 1, 2026
**Version**: 1.0
