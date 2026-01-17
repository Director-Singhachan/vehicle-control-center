# ERP Deployment Checklist

## Pre-Deployment Phase

### 1. Code Review
- [ ] All migration files reviewed for SQL syntax
- [ ] React components follow project conventions
- [ ] Edge Functions have proper error handling
- [ ] Service functions properly typed
- [ ] Documentation is complete and accurate

### 2. Environment Setup
- [ ] Supabase project configured
- [ ] Environment variables set (.env.local)
- [ ] Database backup created
- [ ] Development database ready for testing
- [ ] Production database ready for deployment

### 3. Dependencies
- [ ] All npm packages installed
- [ ] React version compatible
- [ ] TypeScript types generated
- [ ] Supabase client updated to latest

```bash
npm install
supabase gen types typescript --local > types/database.ts
```

### 4. Testing Environment
- [ ] Test database populated with sample data
- [ ] Test users created with different roles
- [ ] Test data includes edge cases
- [ ] Performance baseline established

---

## Database Migration Phase

### 5. Migration Execution

**Step 1: Backup Production Database**
```bash
supabase db pull
# Creates a backup of current schema
```

**Step 2: Apply Migrations in Order**
```bash
# Migration 1: Financial Management
supabase migration up 20260201010000_create_financial_management_module.sql

# Migration 2: Purchase Management
supabase migration up 20260201020000_create_purchase_management_module.sql

# Migration 3: HR Management
supabase migration up 20260201030000_create_hr_management_module.sql
```

**Step 3: Verify Migrations**
```bash
supabase migration list
# All three should show as applied
```

### 6. Schema Validation

- [ ] All 20 tables created
- [ ] All 7 views created
- [ ] All indexes created
- [ ] All triggers created
- [ ] RLS enabled on all tables
- [ ] Foreign key constraints valid

```sql
-- Verification query
SELECT COUNT(*) as table_count FROM information_schema.tables
WHERE table_schema = 'public';
-- Expected: 20 tables
```

### 7. Data Migration (if applicable)

- [ ] Existing data mapped to new tables
- [ ] Data validation completed
- [ ] Referential integrity verified
- [ ] No data loss occurred

---

## Application Deployment Phase

### 8. Frontend Deployment

**Step 1: Update Routes**
```tsx
// In main router file
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

**Step 2: Update Navigation**
```tsx
// In main navigation component
import ERPNavigation from './components/ERPNavigation';

// Add to navigation
<ERPNavigation />
```

**Step 3: Build and Test**
```bash
npm run build
npm run preview
# Test all new routes locally
```

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] All routes accessible
- [ ] Components render correctly

### 9. Edge Functions Deployment

**Step 1: Deploy Functions**
```bash
supabase functions deploy calculate-payroll
supabase functions deploy generate-po-number
supabase functions deploy update-invoice-status
```

**Step 2: Test Functions**
```bash
supabase functions list
# All three should show as deployed

# Test each function
supabase functions invoke calculate-payroll --body '{"staff_id":"test","period_month":2,"period_year":2026}'
```

- [ ] All functions deployed
- [ ] Functions respond correctly
- [ ] Error handling works
- [ ] Logs accessible

### 10. Service Layer Integration

- [ ] erpService.ts imported in components
- [ ] All service methods tested
- [ ] Error handling implemented
- [ ] Loading states handled

```tsx
// Example usage
import { financialService } from './services/erpService';

const handleCreateEntry = async () => {
  try {
    const result = await financialService.createJournalEntry(...);
    // Handle success
  } catch (error) {
    // Handle error
  }
};
```

---

## Security Phase

### 11. RLS Policies Verification

- [ ] All RLS policies enabled
- [ ] Admin role can access all data
- [ ] Manager role can create/update
- [ ] Employee role can only see own data
- [ ] Driver role cannot access financial data

```sql
-- Verify RLS policies
SELECT tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 12. Authentication & Authorization

- [ ] User roles properly configured in profiles table
- [ ] Test users created with each role
- [ ] Permission tests passed
- [ ] Unauthorized access blocked

```sql
-- Create test users
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('admin@test.com', crypt('password', gen_salt('bf')), now());

INSERT INTO profiles (id, email, role)
VALUES (user_id, 'admin@test.com', 'admin');
```

### 13. Data Validation

- [ ] Input validation on all forms
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF tokens implemented (if applicable)

---

## Integration Phase

### 14. Integration with Existing Modules

**Orders to Invoices**
- [ ] When order confirmed, invoice can be created
- [ ] Invoice linked to order
- [ ] Payment tracking works

**Purchase Orders to Inventory**
- [ ] When goods received, inventory updated
- [ ] Inventory transactions created
- [ ] Stock levels accurate

**Commission to Payroll**
- [ ] Commission logs linked to payroll
- [ ] Automatic calculation works
- [ ] Pro-rating supported

**Fuel/Maintenance to Expenses**
- [ ] Fuel records create expense entries
- [ ] Maintenance tickets create expense entries
- [ ] Expense tracking accurate

### 15. Data Consistency

- [ ] Journal entries always balance
- [ ] Inventory quantities match
- [ ] Payroll totals correct
- [ ] No orphaned records

```sql
-- Verify data consistency
SELECT COUNT(*) FROM journal_entries je
WHERE NOT EXISTS (
  SELECT 1 FROM journal_items ji WHERE ji.journal_entry_id = je.id
);
-- Expected: 0 (no entries without items)
```

---

## Testing Phase

### 16. Functional Testing

- [ ] Create journal entry
  - [ ] Add items
  - [ ] Validate balance
  - [ ] Post entry
  - [ ] View in trial balance

- [ ] Create purchase order
  - [ ] Add items
  - [ ] Calculate total
  - [ ] Approve PO
  - [ ] Record receipt

- [ ] Create payroll
  - [ ] Calculate with commission
  - [ ] Add bonus/deductions
  - [ ] Approve and pay
  - [ ] View payroll report

- [ ] Create leave request
  - [ ] Submit request
  - [ ] Approve/reject
  - [ ] View leave balance

### 17. Performance Testing

- [ ] Trial balance query < 1 second
- [ ] Payroll list loads < 2 seconds
- [ ] Journal entries list loads < 2 seconds
- [ ] Reports generate < 5 seconds
- [ ] Concurrent users (10+) supported

```bash
# Load testing
ab -n 100 -c 10 https://your-app/financial/journal-entries
```

### 18. User Acceptance Testing

- [ ] Finance team tests financial module
- [ ] Procurement team tests purchase module
- [ ] HR team tests HR module
- [ ] All feedback documented
- [ ] Issues resolved

---

## Documentation Phase

### 19. Documentation Complete

- [ ] ERP_IMPLEMENTATION_GUIDE.md reviewed
- [ ] RLS_POLICIES_GUIDE.md reviewed
- [ ] ERP_TESTING_GUIDE.md reviewed
- [ ] API documentation updated
- [ ] User manual created

### 20. Training Materials

- [ ] Video tutorials created
- [ ] User guides written
- [ ] FAQ document prepared
- [ ] Support team trained
- [ ] Documentation accessible

---

## Production Deployment

### 21. Pre-Production Verification

- [ ] Staging environment mirrors production
- [ ] All tests pass in staging
- [ ] Performance acceptable in staging
- [ ] Security audit completed
- [ ] Backup strategy verified

### 22. Production Deployment

**Step 1: Final Backup**
```bash
supabase db pull
# Create final backup
```

**Step 2: Deploy to Production**
```bash
# Deploy frontend
npm run build
# Deploy to hosting (Vercel, Netlify, etc.)

# Deploy Edge Functions
supabase functions deploy calculate-payroll --project-ref prod
supabase functions deploy generate-po-number --project-ref prod
supabase functions deploy update-invoice-status --project-ref prod
```

**Step 3: Verify Production**
- [ ] All routes accessible
- [ ] Edge Functions working
- [ ] Database queries working
- [ ] RLS policies enforced
- [ ] Monitoring active

### 23. Post-Deployment Verification

- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify data integrity
- [ ] User feedback collected
- [ ] No critical issues reported

---

## Rollback Plan

### 24. If Issues Occur

**Step 1: Identify Issue**
- [ ] Check error logs
- [ ] Verify data integrity
- [ ] Assess impact

**Step 2: Rollback Database (if needed)**
```bash
# Restore from backup
supabase db push --db-url postgresql://...
```

**Step 3: Rollback Application (if needed)**
```bash
# Revert to previous version
git revert <commit-hash>
npm run build
# Redeploy
```

**Step 4: Communicate Status**
- [ ] Notify users of issue
- [ ] Provide ETA for resolution
- [ ] Keep stakeholders updated

---

## Post-Deployment

### 25. Monitoring & Maintenance

- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up performance monitoring
- [ ] Set up database monitoring
- [ ] Create alerting rules
- [ ] Schedule regular backups

### 26. Ongoing Support

- [ ] Support team ready
- [ ] Documentation accessible
- [ ] Bug tracking system active
- [ ] Feature request process established
- [ ] Regular maintenance scheduled

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Manager | | | |
| Tech Lead | | | |
| QA Lead | | | |
| Finance Manager | | | |
| IT Manager | | | |

---

## Notes

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Approved By**: _______________

---

**Last Updated**: February 1, 2026
**Version**: 1.0
