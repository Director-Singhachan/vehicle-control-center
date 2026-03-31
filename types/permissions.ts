import type { AppRole } from './database';

export type BusinessRole =
  | 'ROLE_PURCHASING_USER'
  | 'ROLE_HR_USER'
  | 'ROLE_OPERATION_USER'
  | 'ROLE_BRANCH_MANAGER'
  | 'ROLE_TOP_MANAGEMENT'
  | 'ROLE_SYSTEM_ADMIN'
  | 'ROLE_SALES_USER'
  | 'ROLE_DEV';

export const APP_ROLE_TO_BUSINESS_ROLE: Partial<Record<AppRole, BusinessRole>> = {
  accounting: 'ROLE_PURCHASING_USER',
  hr: 'ROLE_HR_USER',
  warehouse: 'ROLE_OPERATION_USER',
  manager: 'ROLE_BRANCH_MANAGER',
  executive: 'ROLE_TOP_MANAGEMENT',
  admin: 'ROLE_SYSTEM_ADMIN',
  sales: 'ROLE_SALES_USER',
  dev: 'ROLE_DEV',
};

