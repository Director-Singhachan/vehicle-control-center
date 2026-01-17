-- ========================================================
-- HR Management Module (ทรัพยากรบุคคล)
-- Migration: 20260201030000
-- ========================================================

-- ========================================================
-- 1. EMPLOYEE DETAILS (ข้อมูลพนักงานเพิ่มเติม)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.employee_details (
  id UUID PRIMARY KEY REFERENCES public.service_staff(id) ON DELETE CASCADE,
  id_card_no TEXT UNIQUE,
  birth_date DATE,
  join_date DATE,
  salary DECIMAL(15, 2) DEFAULT 0,
  bank_account_no TEXT,
  bank_name TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_details_id_card ON public.employee_details(id_card_no);
CREATE INDEX IF NOT EXISTS idx_employee_details_join_date ON public.employee_details(join_date);

-- ========================================================
-- 2. LEAVE REQUESTS (การลา)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'annual', 'personal', 'maternity', 'paternity', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days DECIMAL(5, 2) GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON public.leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- ========================================================
-- 3. ATTENDANCE RECORDS (บันทึกการเข้างาน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'leave', 'holiday')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_attendance_per_day UNIQUE (staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_staff ON public.attendance_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON public.attendance_records(attendance_date);

-- ========================================================
-- 4. PAYROLL RECORDS (การจ่ายเงินเดือน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL,
  base_salary DECIMAL(15, 2) DEFAULT 0,
  commission_amount DECIMAL(15, 2) DEFAULT 0,
  bonus DECIMAL(15, 2) DEFAULT 0,
  deductions DECIMAL(15, 2) DEFAULT 0,
  net_payable DECIMAL(15, 2) GENERATED ALWAYS AS (base_salary + commission_amount + bonus - deductions) STORED,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_payroll_per_period UNIQUE (staff_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_staff ON public.payroll_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON public.payroll_records(period_month, period_year);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON public.payroll_records(status);

-- ========================================================
-- 5. PAYROLL DEDUCTIONS (หักเงินเดือน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.payroll_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id UUID NOT NULL REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  deduction_type TEXT NOT NULL, -- เช่น 'tax', 'social_security', 'health_insurance', 'loan'
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_deductions_payroll ON public.payroll_deductions(payroll_record_id);

-- ========================================================
-- 6. ALLOWANCES (เบี้ยเลี้ยง/ค่าตอบแทนเพิ่มเติม)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
  allowance_type TEXT NOT NULL, -- เช่น 'transportation', 'meal', 'housing', 'performance'
  amount DECIMAL(15, 2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allowances_staff ON public.allowances(staff_id);
CREATE INDEX IF NOT EXISTS idx_allowances_type ON public.allowances(allowance_type);

-- ========================================================
-- 7. EMPLOYEE PERFORMANCE (ประเมินผลการทำงาน)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.employee_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.service_staff(id) ON DELETE CASCADE,
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  evaluator_id UUID REFERENCES public.profiles(id),
  performance_score DECIMAL(5, 2) CHECK (performance_score >= 0 AND performance_score <= 100),
  attendance_score DECIMAL(5, 2),
  quality_score DECIMAL(5, 2),
  punctuality_score DECIMAL(5, 2),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_performance_staff ON public.employee_performance(staff_id);
CREATE INDEX IF NOT EXISTS idx_employee_performance_date ON public.employee_performance(evaluation_date);

-- ========================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ========================================================

ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_performance ENABLE ROW LEVEL SECURITY;

-- Employee Details: Employees can see their own, managers/admins can see all
CREATE POLICY employee_details_select ON public.employee_details
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY employee_details_insert ON public.employee_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY employee_details_update ON public.employee_details
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Leave Requests: Employees can see their own, managers/admins can see all
CREATE POLICY leave_requests_select ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY leave_requests_insert ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY leave_requests_update ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Attendance Records: Managers/Admins only
CREATE POLICY attendance_records_select ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

CREATE POLICY attendance_records_insert ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Payroll Records: Managers/Admins only
CREATE POLICY payroll_records_select ON public.payroll_records
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY payroll_records_insert ON public.payroll_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Allowances: Managers/Admins can manage
CREATE POLICY allowances_select ON public.allowances
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY allowances_insert ON public.allowances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Employee Performance: Managers/Admins can manage
CREATE POLICY employee_performance_select ON public.employee_performance
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY employee_performance_insert ON public.employee_performance
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
-- 9. TRIGGERS FOR UPDATED_AT
-- ========================================================

CREATE OR REPLACE FUNCTION update_employee_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_details_updated_at
  BEFORE UPDATE ON public.employee_details
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_details_updated_at();

CREATE OR REPLACE FUNCTION update_leave_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_requests_updated_at();

CREATE OR REPLACE FUNCTION update_payroll_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_records_updated_at();

CREATE OR REPLACE FUNCTION update_allowances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_allowances_updated_at
  BEFORE UPDATE ON public.allowances
  FOR EACH ROW
  EXECUTE FUNCTION update_allowances_updated_at();

-- ========================================================
-- 10. VIEWS FOR REPORTING
-- ========================================================

-- Employee Summary (สรุปข้อมูลพนักงาน)
CREATE OR REPLACE VIEW public.employee_summary AS
SELECT
  ss.id,
  ss.name,
  ss.status,
  ss.employee_code,
  ed.join_date,
  ed.salary,
  ed.bank_name,
  COUNT(DISTINCT CASE WHEN lr.status = 'approved' THEN lr.id END) as approved_leaves,
  COUNT(DISTINCT CASE WHEN lr.status = 'pending' THEN lr.id END) as pending_leaves,
  AVG(ep.performance_score) as avg_performance_score
FROM public.service_staff ss
LEFT JOIN public.employee_details ed ON ss.id = ed.id
LEFT JOIN public.leave_requests lr ON ss.id = lr.staff_id
LEFT JOIN public.employee_performance ep ON ss.id = ep.staff_id
GROUP BY ss.id, ss.name, ss.status, ss.employee_code, ed.join_date, ed.salary, ed.bank_name;

-- Payroll Summary (สรุปเงินเดือน)
CREATE OR REPLACE VIEW public.payroll_summary AS
SELECT
  ss.id,
  ss.name,
  pr.period_month,
  pr.period_year,
  pr.base_salary,
  pr.commission_amount,
  pr.bonus,
  pr.deductions,
  pr.net_payable,
  pr.status,
  pr.paid_at
FROM public.service_staff ss
LEFT JOIN public.payroll_records pr ON ss.id = pr.staff_id
ORDER BY pr.period_year DESC, pr.period_month DESC;

-- Leave Balance (ยอดวันลาคงเหลือ)
CREATE OR REPLACE VIEW public.leave_balance AS
SELECT
  ss.id,
  ss.name,
  COUNT(CASE WHEN lr.leave_type = 'annual' AND lr.status = 'approved' THEN 1 END) as annual_leaves_used,
  COUNT(CASE WHEN lr.leave_type = 'sick' AND lr.status = 'approved' THEN 1 END) as sick_leaves_used,
  COUNT(CASE WHEN lr.leave_type = 'personal' AND lr.status = 'approved' THEN 1 END) as personal_leaves_used
FROM public.service_staff ss
LEFT JOIN public.leave_requests lr ON ss.id = lr.staff_id
GROUP BY ss.id, ss.name;

GRANT SELECT ON public.employee_summary TO authenticated;
GRANT SELECT ON public.payroll_summary TO authenticated;
GRANT SELECT ON public.leave_balance TO authenticated;

-- ========================================================
-- 11. COMMENTS
-- ========================================================

COMMENT ON TABLE public.employee_details IS 'ข้อมูลพนักงานเพิ่มเติม';
COMMENT ON TABLE public.leave_requests IS 'การลางาน';
COMMENT ON TABLE public.attendance_records IS 'บันทึกการเข้างาน';
COMMENT ON TABLE public.payroll_records IS 'บันทึกการจ่ายเงินเดือน';
COMMENT ON TABLE public.payroll_deductions IS 'หักเงินเดือน';
COMMENT ON TABLE public.allowances IS 'เบี้ยเลี้ยง/ค่าตอบแทนเพิ่มเติม';
COMMENT ON TABLE public.employee_performance IS 'ประเมินผลการทำงาน';
