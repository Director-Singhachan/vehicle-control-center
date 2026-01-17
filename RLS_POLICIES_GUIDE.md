# Row Level Security (RLS) Policies Guide

## Overview

This document describes the Row Level Security (RLS) policies implemented for the ERP modules. RLS ensures that users can only access data they are authorized to view or modify based on their role.

---

## User Roles

The system uses the following roles defined in the `profiles` table:

| Role | Description | Permissions |
|------|-------------|-------------|
| **admin** | System administrator | Full access to all modules and data |
| **manager** | Department manager | Create, read, update financial and HR records |
| **inspector** | Quality inspector | Read-only access to reports and inventory |
| **sales** | Sales representative | Create and manage orders, view own commission |
| **driver** | Delivery driver | View own payroll, attendance, and commission |

---

## Financial Management RLS Policies

### Chart of Accounts

```sql
-- SELECT: All authenticated users can view
CREATE POLICY chart_of_accounts_select ON chart_of_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE: Only admins and managers
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

### Journal Entries

```sql
-- SELECT: All authenticated users can view
CREATE POLICY journal_entries_select ON journal_entries
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only admins and managers
CREATE POLICY journal_entries_insert ON journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- UPDATE: Only admins and managers, only draft entries
CREATE POLICY journal_entries_update ON journal_entries
  FOR UPDATE
  TO authenticated
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

### Invoices

```sql
-- SELECT: Sales can see own, managers/admins see all
CREATE POLICY invoices_select ON invoices
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- INSERT: Only sales, managers, admins
CREATE POLICY invoices_insert ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales')
    )
  );
```

---

## Purchase Management RLS Policies

### Suppliers

```sql
-- SELECT: All authenticated users
CREATE POLICY suppliers_select ON suppliers
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE: Only admins and managers
CREATE POLICY suppliers_insert ON suppliers
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

### Purchase Orders

```sql
-- SELECT: All authenticated users
CREATE POLICY purchase_orders_select ON purchase_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only admins and managers
CREATE POLICY purchase_orders_insert ON purchase_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- UPDATE: Only admins and managers, only draft/pending POs
CREATE POLICY purchase_orders_update ON purchase_orders
  FOR UPDATE
  TO authenticated
  USING (
    status IN ('draft', 'pending')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

---

## HR Management RLS Policies

### Employee Details

```sql
-- SELECT: Employees can see own, managers/admins see all
CREATE POLICY employee_details_select ON employee_details
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- INSERT/UPDATE: Only managers and admins
CREATE POLICY employee_details_insert ON employee_details
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

### Leave Requests

```sql
-- SELECT: Employees can see own, managers/admins see all
CREATE POLICY leave_requests_select ON leave_requests
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- INSERT: Employees can create own, managers/admins can create for anyone
CREATE POLICY leave_requests_insert ON leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- UPDATE: Only managers/admins can approve
CREATE POLICY leave_requests_update ON leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

### Attendance Records

```sql
-- SELECT: Only managers, admins, and inspectors
CREATE POLICY attendance_records_select ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

-- INSERT: Only managers and admins
CREATE POLICY attendance_records_insert ON attendance_records
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

### Payroll Records

```sql
-- SELECT: Employees can see own, managers/admins see all
CREATE POLICY payroll_records_select ON payroll_records
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- INSERT/UPDATE: Only managers and admins
CREATE POLICY payroll_records_insert ON payroll_records
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

## Testing RLS Policies

### Test Case 1: Driver Viewing Own Payroll

```sql
-- As driver (role = 'driver')
SELECT * FROM payroll_records WHERE staff_id = auth.uid();
-- Expected: Returns payroll records for the driver only
```

### Test Case 2: Manager Viewing All Payroll

```sql
-- As manager (role = 'manager')
SELECT * FROM payroll_records;
-- Expected: Returns all payroll records
```

### Test Case 3: Driver Cannot Create Journal Entry

```sql
-- As driver (role = 'driver')
INSERT INTO journal_entries (entry_date, reference_no, description, status)
VALUES ('2026-02-01', 'TEST-001', 'Test', 'draft');
-- Expected: Permission denied error
```

### Test Case 4: Manager Can Create Journal Entry

```sql
-- As manager (role = 'manager')
INSERT INTO journal_entries (entry_date, reference_no, description, status)
VALUES ('2026-02-01', 'TEST-001', 'Test', 'draft');
-- Expected: Success
```

### Test Case 5: Employee Cannot Update Others' Leave Request

```sql
-- As employee (role = 'driver')
UPDATE leave_requests SET status = 'approved' WHERE id = 'other_employee_id';
-- Expected: Permission denied error
```

### Test Case 6: Manager Can Approve Leave Request

```sql
-- As manager (role = 'manager')
UPDATE leave_requests SET status = 'approved', approved_by = auth.uid()
WHERE id = 'leave_request_id';
-- Expected: Success
```

---

## Common RLS Issues & Solutions

### Issue 1: "Permission denied" on SELECT

**Cause**: User's role is not included in the USING clause

**Solution**: Check the user's role in the profiles table and verify the RLS policy includes that role

```sql
-- Check user role
SELECT id, email, role FROM profiles WHERE id = auth.uid();

-- Verify RLS policy
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename = 'journal_entries';
```

### Issue 2: Users can see data they shouldn't

**Cause**: RLS policy is too permissive or missing

**Solution**: Review and tighten the RLS policy

```sql
-- Example: Restrict to role-based access
CREATE POLICY restricted_access ON table_name
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

### Issue 3: Cascade delete not working

**Cause**: Foreign key constraints not set with ON DELETE CASCADE

**Solution**: Check foreign key constraints

```sql
-- View constraints
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'journal_items';
```

---

## Best Practices

1. **Always enable RLS** on sensitive tables
2. **Use role-based policies** instead of user-specific checks when possible
3. **Test policies** with different user roles before deployment
4. **Document policies** for maintenance and auditing
5. **Use views** for complex permission logic
6. **Audit access** by logging who accesses what data
7. **Review policies** regularly for security gaps

---

## Monitoring & Auditing

### View Active RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check RLS Enforcement

```sql
-- View which tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

### Audit Log Query

```sql
-- View recent changes (if audit triggers are set up)
SELECT * FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;
```

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

---

**Last Updated**: February 1, 2026
**Version**: 1.0
