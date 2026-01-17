# ERP Implementation Guide - Vehicle Control Center

## 📋 Overview

This document provides a comprehensive guide for implementing the ERP modules into the Vehicle Control Center system. The ERP system consists of three main modules:

1. **Financial Management** - Accounting and financial tracking
2. **Purchase Management** - Procurement and supplier management
3. **HR Management** - Human resources and payroll

---

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL) + Edge Functions
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth

### Module Structure

```
vehicle-control-center/
├── sql/
│   ├── 20260201010000_create_financial_management_module.sql
│   ├── 20260201020000_create_purchase_management_module.sql
│   └── 20260201030000_create_hr_management_module.sql
├── views/
│   ├── JournalEntriesView.tsx
│   ├── PurchaseOrdersView.tsx
│   ├── PayrollManagementView.tsx
│   └── FinancialReportsView.tsx
└── types/
    └── database.ts (auto-generated)
```

---

## 1️⃣ Financial Management Module

### Database Schema

#### Chart of Accounts (ผังบัญชี)
Stores the chart of accounts with hierarchical structure.

```sql
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- Account code (e.g., 110100)
  name TEXT NOT NULL,                -- Account name (e.g., Cash)
  account_type TEXT NOT NULL,        -- asset, liability, equity, revenue, expense
  parent_id UUID,                    -- Parent account for hierarchy
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Journal Entries (สมุดรายวัน)
Double-entry bookkeeping system for recording transactions.

```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  entry_date DATE NOT NULL,
  reference_no TEXT,                 -- Reference number (e.g., INV-001)
  description TEXT,
  status TEXT,                       -- draft, posted, cancelled
  created_by UUID,
  created_at TIMESTAMPTZ
);

CREATE TABLE journal_items (
  id UUID PRIMARY KEY,
  journal_entry_id UUID NOT NULL,
  account_id UUID NOT NULL,
  debit DECIMAL(15, 2),
  credit DECIMAL(15, 2),
  note TEXT,
  line_number INTEGER
);
```

#### Invoices (ใบแจ้งหนี้)
Linked to Orders for Accounts Receivable tracking.

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  order_id UUID,                     -- Link to orders
  customer_id UUID,
  issue_date DATE,
  due_date DATE,
  total_amount DECIMAL(15, 2),
  tax_amount DECIMAL(15, 2),
  paid_amount DECIMAL(15, 2),
  status TEXT                        -- unpaid, partial, paid, overdue
);
```

#### Payment Records (บันทึกการชำระเงิน)
Track customer payments.

```sql
CREATE TABLE payment_records (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL,
  payment_date DATE,
  amount DECIMAL(15, 2),
  payment_method TEXT,               -- cash, bank_transfer, check, credit_card
  reference_no TEXT,
  created_by UUID
);
```

#### Expense Records (บันทึกค่าใช้จ่าย)
Track all business expenses.

```sql
CREATE TABLE expense_records (
  id UUID PRIMARY KEY,
  expense_date DATE,
  expense_type TEXT,                 -- fuel, maintenance, supplies, etc.
  category_id UUID,                  -- Link to chart of accounts
  amount DECIMAL(15, 2),
  description TEXT,
  reference_id UUID,                 -- Link to source (fuel_records, tickets, etc.)
  reference_type TEXT,               -- fuel, ticket, purchase_order
  payment_method TEXT
);
```

### Views for Reporting

#### Trial Balance (ยอดทดลอง)
```sql
CREATE VIEW trial_balance AS
SELECT
  coa.code,
  coa.name,
  coa.account_type,
  SUM(ji.debit) as total_debit,
  SUM(ji.credit) as total_credit,
  SUM(ji.debit) - SUM(ji.credit) as balance
FROM chart_of_accounts coa
LEFT JOIN journal_items ji ON coa.id = ji.account_id
LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
WHERE je.status = 'posted'
GROUP BY coa.id, coa.code, coa.name, coa.account_type
ORDER BY coa.code;
```

#### Account Ledger (บัญชีแยกประเภท)
```sql
CREATE VIEW account_ledger AS
SELECT
  coa.code,
  coa.name,
  je.entry_date,
  je.reference_no,
  ji.debit,
  ji.credit,
  SUM(ji.debit - ji.credit) OVER (
    PARTITION BY coa.id
    ORDER BY je.entry_date, je.created_at
  ) as running_balance
FROM chart_of_accounts coa
JOIN journal_items ji ON coa.id = ji.account_id
JOIN journal_entries je ON ji.journal_entry_id = je.id
WHERE je.status = 'posted'
ORDER BY coa.code, je.entry_date;
```

### React Components

#### JournalEntriesView.tsx
Features:
- Create journal entries with double-entry validation
- Add/remove line items
- Automatic debit/credit balance checking
- Post entries to ledger
- View entry history

Usage:
```tsx
import JournalEntriesView from './views/JournalEntriesView';

// In your router
<Route path="/financial/journal-entries" element={<JournalEntriesView />} />
```

#### FinancialReportsView.tsx
Features:
- Trial Balance report
- Accounts Receivable summary
- Expense summary by type
- Date range filtering
- Export-ready data

---

## 2️⃣ Purchase Management Module

### Database Schema

#### Suppliers (ผู้ขาย)
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,                -- e.g., "Net 30", "COD"
  is_active BOOLEAN DEFAULT TRUE
);
```

#### Purchase Orders (ใบสั่งซื้อ)
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,    -- Auto-generated: PO-YYMM-XXXX
  supplier_id UUID NOT NULL,
  warehouse_id UUID,
  order_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  total_amount DECIMAL(15, 2),
  tax_amount DECIMAL(15, 2),
  status TEXT                        -- draft, pending, approved, received, cancelled
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY,
  po_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity DECIMAL(10, 2),
  unit_price DECIMAL(15, 2),
  received_quantity DECIMAL(10, 2),
  subtotal DECIMAL(15, 2)           -- Generated column
);
```

#### Goods Receipts (ใบรับสินค้า)
```sql
CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY,
  receipt_no TEXT UNIQUE NOT NULL,   -- Auto-generated: GR-YYMM-XXXX
  po_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  receipt_date DATE,
  received_by UUID,
  status TEXT                        -- pending, completed, rejected
);

CREATE TABLE goods_receipt_items (
  id UUID PRIMARY KEY,
  receipt_id UUID NOT NULL,
  po_item_id UUID NOT NULL,
  quantity_received DECIMAL(10, 2),
  quality_status TEXT                -- good, damaged, defective
);
```

#### Supplier Invoices (ใบแจ้งหนี้จากผู้ขาย - A/P)
```sql
CREATE TABLE supplier_invoices (
  id UUID PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  supplier_id UUID NOT NULL,
  po_id UUID,
  invoice_date DATE,
  due_date DATE,
  total_amount DECIMAL(15, 2),
  tax_amount DECIMAL(15, 2),
  paid_amount DECIMAL(15, 2),
  status TEXT                        -- unpaid, partial, paid, overdue, cancelled
);

CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY,
  supplier_invoice_id UUID NOT NULL,
  payment_date DATE,
  amount DECIMAL(15, 2),
  payment_method TEXT,
  reference_no TEXT
);
```

### React Components

#### PurchaseOrdersView.tsx
Features:
- Create purchase orders with automatic PO numbering
- Add/remove line items with product selection
- Calculate total automatically
- Approve purchase orders
- Track goods receipt status
- View PO history

Usage:
```tsx
import PurchaseOrdersView from './views/PurchaseOrdersView';

// In your router
<Route path="/purchase/orders" element={<PurchaseOrdersView />} />
```

---

## 3️⃣ HR Management Module

### Database Schema

#### Employee Details (ข้อมูลพนักงาน)
```sql
CREATE TABLE employee_details (
  id UUID PRIMARY KEY REFERENCES service_staff(id),
  id_card_no TEXT UNIQUE,
  birth_date DATE,
  join_date DATE,
  salary DECIMAL(15, 2),
  bank_account_no TEXT,
  bank_name TEXT,
  emergency_contact TEXT,
  address TEXT
);
```

#### Leave Requests (การลา)
```sql
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL,
  leave_type TEXT,                   -- sick, annual, personal, maternity, paternity
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days DECIMAL(5, 2),     -- Generated column
  reason TEXT,
  status TEXT,                       -- pending, approved, rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ
);
```

#### Attendance Records (บันทึกการเข้างาน)
```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status TEXT,                       -- present, absent, late, leave, holiday
  UNIQUE (staff_id, attendance_date)
);
```

#### Payroll Records (เงินเดือน)
```sql
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL,
  period_month INTEGER,
  period_year INTEGER,
  base_salary DECIMAL(15, 2),
  commission_amount DECIMAL(15, 2),  -- From commission_logs
  bonus DECIMAL(15, 2),
  deductions DECIMAL(15, 2),
  net_payable DECIMAL(15, 2),       -- Generated column
  status TEXT,                       -- draft, approved, paid, cancelled
  paid_at TIMESTAMPTZ,
  UNIQUE (staff_id, period_month, period_year)
);

CREATE TABLE payroll_deductions (
  id UUID PRIMARY KEY,
  payroll_record_id UUID NOT NULL,
  deduction_type TEXT,               -- tax, social_security, health_insurance, loan
  amount DECIMAL(15, 2)
);
```

#### Allowances (เบี้ยเลี้ยง)
```sql
CREATE TABLE allowances (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL,
  allowance_type TEXT,               -- transportation, meal, housing, performance
  amount DECIMAL(15, 2),
  effective_from DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT TRUE
);
```

#### Employee Performance (ประเมินผลการทำงาน)
```sql
CREATE TABLE employee_performance (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL,
  evaluation_date DATE,
  evaluator_id UUID,
  performance_score DECIMAL(5, 2),   -- 0-100
  attendance_score DECIMAL(5, 2),
  quality_score DECIMAL(5, 2),
  punctuality_score DECIMAL(5, 2),
  comments TEXT
);
```

### React Components

#### PayrollManagementView.tsx
Features:
- Create payroll records for specific month/year
- Automatic commission calculation from commission_logs
- Add bonuses and deductions
- Approve and pay payroll
- Month/year filtering
- View payroll history

Usage:
```tsx
import PayrollManagementView from './views/PayrollManagementView';

// In your router
<Route path="/hr/payroll" element={<PayrollManagementView />} />
```

---

## 🔐 Row Level Security (RLS) Policies

All tables have RLS enabled with role-based access control:

### Roles
- **admin**: Full access to all modules
- **manager**: Can create, read, update financial and HR records
- **inspector**: Read-only access to reports
- **sales**: Can create and manage orders/invoices
- **driver**: Can view own payroll and attendance

### Example RLS Policy
```sql
-- Chart of Accounts: All authenticated users can read, only admins/managers can modify
CREATE POLICY chart_of_accounts_select ON chart_of_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY chart_of_accounts_insert ON chart_of_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

---

## 📊 Integration with Existing Modules

### Connections to Current System

1. **Orders → Invoices**
   - When an order is confirmed, create an invoice
   - Track payments against invoices

2. **Purchase Orders → Inventory**
   - When goods are received, update inventory
   - Create inventory transactions for tracking

3. **Commission Logs → Payroll**
   - Automatically include commission in payroll calculation
   - Support pro-rating for partial work

4. **Fuel Records & Tickets → Expenses**
   - Auto-create expense records from fuel logs
   - Link maintenance costs to expense tracking

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# Apply migrations in order
supabase migration up 20260201010000_create_financial_management_module.sql
supabase migration up 20260201020000_create_purchase_management_module.sql
supabase migration up 20260201030000_create_hr_management_module.sql
```

### 2. Update Type Definitions
```bash
# Regenerate database types
supabase gen types typescript --local > types/database.ts
```

### 3. Add Routes to Main App
```tsx
// In your main router
import JournalEntriesView from './views/JournalEntriesView';
import PurchaseOrdersView from './views/PurchaseOrdersView';
import PayrollManagementView from './views/PayrollManagementView';
import FinancialReportsView from './views/FinancialReportsView';

// Add routes
<Route path="/financial/journal-entries" element={<JournalEntriesView />} />
<Route path="/financial/reports" element={<FinancialReportsView />} />
<Route path="/purchase/orders" element={<PurchaseOrdersView />} />
<Route path="/hr/payroll" element={<PayrollManagementView />} />
```

### 4. Create Navigation Menu Items
Add menu items for new modules in the main navigation component.

---

## 📝 Sample Data Setup

### Chart of Accounts Template
```sql
INSERT INTO chart_of_accounts (code, name, account_type) VALUES
('110100', 'เงินสด', 'asset'),
('110200', 'เงินฝากธนาคาร', 'asset'),
('120100', 'ลูกหนี้การค้า', 'asset'),
('210100', 'เจ้าหนี้การค้า', 'liability'),
('310100', 'ทุนเรือนหุ่น', 'equity'),
('410100', 'รายได้จากการขาย', 'revenue'),
('510100', 'ค่าน้ำมัน', 'expense'),
('510200', 'ค่าซ่อมบำรุง', 'expense'),
('510300', 'ค่าเงินเดือน', 'expense');
```

### Commission Rates Template
```sql
INSERT INTO commission_rates (rate_name, vehicle_type, service_type, rate_per_unit) VALUES
('4-Wheel Standard', '4-wheel', 'standard', 50.00),
('6-Wheel Standard', '6-wheel', 'standard', 75.00),
('10-Wheel Standard', '10-wheel', 'standard', 100.00);
```

---

## 🧪 Testing Checklist

- [ ] Journal entries balance correctly
- [ ] Trial balance totals match
- [ ] Purchase orders auto-number correctly
- [ ] Goods receipts link to POs
- [ ] Payroll calculations include commissions
- [ ] Leave requests can be approved/rejected
- [ ] Attendance records track daily
- [ ] All RLS policies work correctly
- [ ] Reports generate without errors
- [ ] Date filtering works in reports

---

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Date Functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [React Form Handling](https://react.dev/reference/react-dom/components/input)

---

## 🤝 Support & Troubleshooting

### Common Issues

**Q: Journal entries won't post**
A: Check that debit and credit totals are equal. Use the balance indicator in the form.

**Q: PO numbers not generating**
A: Ensure the trigger function is enabled and the advisory lock is working.

**Q: Payroll not showing commission**
A: Verify commission_logs exist for the staff member in the period.

---

## 📞 Contact

For questions or issues, contact the development team.

---

**Last Updated**: February 1, 2026
**Version**: 1.0
