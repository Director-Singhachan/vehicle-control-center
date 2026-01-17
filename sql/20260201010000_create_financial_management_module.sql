-- ========================================================
-- Financial Management Module (บัญชีและการเงิน)
-- Migration: 20260201010000
-- ========================================================

-- ========================================================
-- 1. CHART OF ACCOUNTS (ผังบัญชี)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- รหัสบัญชี เช่น 110100
  name TEXT NOT NULL, -- ชื่อบัญชี เช่น เงินสด
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code ON public.chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON public.chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON public.chart_of_accounts(parent_id);

-- ========================================================
-- 2. JOURNAL ENTRIES (สมุดรายวัน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no TEXT, -- เลขที่อ้างอิง เช่น IV-2026001
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries(reference_no);

-- ========================================================
-- 3. JOURNAL ITEMS (รายการในสมุดรายวัน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  note TEXT,
  line_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_debit_credit CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT check_debit_or_credit CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_items_entry ON public.journal_items(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_account ON public.journal_items(account_id);

-- ========================================================
-- 4. INVOICES (ใบแจ้งหนี้/ใบกำกับภาษี)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_no ON public.invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(issue_date);

-- ========================================================
-- 5. PAYMENT RECORDS (บันทึกการชำระเงิน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15, 2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'credit_card', 'other')),
  reference_no TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_invoice ON public.payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON public.payment_records(payment_date);

-- ========================================================
-- 6. EXPENSE RECORDS (บันทึกค่าใช้จ่าย)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL, -- เช่น fuel, maintenance, supplies
  category_id UUID REFERENCES public.chart_of_accounts(id),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  reference_id UUID, -- เชื่อมกับ fuel_records, ticket_costs, etc.
  reference_type TEXT, -- fuel, ticket, purchase_order, etc.
  payment_method TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_records_date ON public.expense_records(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_records_type ON public.expense_records(expense_type);
CREATE INDEX IF NOT EXISTS idx_expense_records_category ON public.expense_records(category_id);

-- ========================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ========================================================

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_records ENABLE ROW LEVEL SECURITY;

-- Chart of Accounts: All authenticated users can read, only admins/managers can modify
CREATE POLICY chart_of_accounts_select ON public.chart_of_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY chart_of_accounts_insert ON public.chart_of_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY chart_of_accounts_update ON public.chart_of_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Journal Entries: Managers/Admins can manage
CREATE POLICY journal_entries_select ON public.journal_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY journal_entries_insert ON public.journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY journal_entries_update ON public.journal_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Journal Items: Same as journal entries
CREATE POLICY journal_items_select ON public.journal_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_items.journal_entry_id
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector')
      )
    )
  );

CREATE POLICY journal_items_insert ON public.journal_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_items.journal_entry_id
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
      )
    )
  );

-- Invoices: Sales/Managers/Admins can manage
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'sales')
    )
  );

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales')
    )
  );

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales')
    )
  );

-- Payment Records: Managers/Admins only
CREATE POLICY payment_records_select ON public.payment_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY payment_records_insert ON public.payment_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Expense Records: Managers/Admins can manage
CREATE POLICY expense_records_select ON public.expense_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY expense_records_insert ON public.expense_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ========================================================

CREATE OR REPLACE FUNCTION update_chart_of_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_chart_of_accounts_updated_at();

CREATE OR REPLACE FUNCTION update_journal_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entries_updated_at();

CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- ========================================================
-- 9. VIEWS FOR REPORTING
-- ========================================================

-- Trial Balance (ยอดทดลอง)
CREATE OR REPLACE VIEW public.trial_balance AS
SELECT
  coa.code,
  coa.name,
  coa.account_type,
  COALESCE(SUM(ji.debit), 0) as total_debit,
  COALESCE(SUM(ji.credit), 0) as total_credit,
  COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0) as balance
FROM public.chart_of_accounts coa
LEFT JOIN public.journal_items ji ON coa.id = ji.account_id
LEFT JOIN public.journal_entries je ON ji.journal_entry_id = je.id
WHERE je.status = 'posted'
GROUP BY coa.id, coa.code, coa.name, coa.account_type
ORDER BY coa.code;

-- Account Ledger (บัญชีแยกประเภท)
CREATE OR REPLACE VIEW public.account_ledger AS
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
FROM public.chart_of_accounts coa
JOIN public.journal_items ji ON coa.id = ji.account_id
JOIN public.journal_entries je ON ji.journal_entry_id = je.id
WHERE je.status = 'posted'
ORDER BY coa.code, je.entry_date;

-- Accounts Receivable Summary (สรุปลูกหนี้)
CREATE OR REPLACE VIEW public.accounts_receivable_summary AS
SELECT
  i.customer_id,
  p.full_name,
  COUNT(i.id) as invoice_count,
  SUM(i.total_amount) as total_invoiced,
  SUM(i.paid_amount) as total_paid,
  SUM(i.total_amount - i.paid_amount) as outstanding_amount,
  MAX(i.issue_date) as last_invoice_date
FROM public.invoices i
LEFT JOIN public.profiles p ON i.customer_id = p.id
WHERE i.status != 'cancelled'
GROUP BY i.customer_id, p.full_name;

GRANT SELECT ON public.trial_balance TO authenticated;
GRANT SELECT ON public.account_ledger TO authenticated;
GRANT SELECT ON public.accounts_receivable_summary TO authenticated;

-- ========================================================
-- 10. COMMENTS
-- ========================================================

COMMENT ON TABLE public.chart_of_accounts IS 'ผังบัญชี (Chart of Accounts) สำหรับบันทึกบัญชี';
COMMENT ON TABLE public.journal_entries IS 'สมุดรายวัน (Journal Entries) บันทึกรายการทางบัญชี';
COMMENT ON TABLE public.journal_items IS 'รายการในสมุดรายวัน';
COMMENT ON TABLE public.invoices IS 'ใบแจ้งหนี้/ใบกำกับภาษี';
COMMENT ON TABLE public.payment_records IS 'บันทึกการชำระเงิน';
COMMENT ON TABLE public.expense_records IS 'บันทึกค่าใช้จ่าย';
