import type { AppRole, Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type OrderBranchVisibility = Database['public']['Enums']['order_branch_visibility'];

export interface OrderBranchScope {
  /** กำลังโหลดจาก role_order_branch_scope */
  loading: boolean;
  /** true = ใช้คลัง/ร้าน/ออเดอร์ทุกสาขา (ตามเดิมหลัง resolve) */
  unrestricted: boolean;
  /** เมื่อ unrestricted = false — รหัสสาขาที่อนุญาต */
  allowedBranches: string[];
}

/** สอดคล้องกับ RLS: ว่าง/null → HQ */
export function normalizeProfileBranch(branch: string | null | undefined): string {
  const t = branch?.trim();
  return t && t.length > 0 ? t : 'HQ';
}

function legacyUnrestricted(profile: Profile | null): boolean {
  if (!profile?.role) return true;
  const r = profile.role as AppRole;
  const high =
    r === 'admin' ||
    r === 'manager' ||
    r === 'inspector' ||
    r === 'executive';
  return high || profile.branch === 'HQ';
}

/**
 * @param dbVisibility จากตาราง role_order_branch_scope สำหรับ (role, profile_branch) ของผู้ใช้ — null = ไม่มีแถว (ใช้กฎ legacy)
 */
export function resolveOrderBranchScope(
  profile: Profile | null,
  dbVisibility: OrderBranchVisibility | null,
  loading: boolean,
): OrderBranchScope {
  if (loading) {
    return { loading: true, unrestricted: false, allowedBranches: [] };
  }

  if (dbVisibility === 'all_branches') {
    return { loading: false, unrestricted: true, allowedBranches: [] };
  }

  if (dbVisibility === 'own_branch_only') {
    const b = normalizeProfileBranch(profile?.branch);
    return { loading: false, unrestricted: false, allowedBranches: [b] };
  }

  if (legacyUnrestricted(profile)) {
    return { loading: false, unrestricted: true, allowedBranches: [] };
  }

  const b = profile?.branch?.trim();
  if (b) {
    return { loading: false, unrestricted: false, allowedBranches: [b] };
  }

  return { loading: false, unrestricted: true, allowedBranches: [] };
}

export function filterByOrderBranchScope<T extends { branch?: string | null }>(
  rows: T[],
  scope: OrderBranchScope,
): T[] {
  if (scope.loading) return [];
  if (scope.unrestricted) return rows;
  const set = new Set(scope.allowedBranches);
  return rows.filter((r) => r.branch != null && set.has(String(r.branch)));
}

/** ค่า filter ส่งเข้า ordersService — undefined = ไม่จำกัดสาขาใน query */
export function orderQueryFiltersForUiBranch(
  scope: OrderBranchScope,
  uiBranchValue: string,
  allSentinel: string,
): { branch?: string; branchesIn?: string[] } | undefined {
  const isAll = !uiBranchValue || uiBranchValue === allSentinel;
  if (scope.loading) return { branchesIn: [] };

  if (scope.unrestricted) {
    return isAll ? undefined : { branch: uiBranchValue };
  }

  if (scope.allowedBranches.length === 0) {
    return { branchesIn: [] };
  }

  if (isAll) {
    return { branchesIn: [...scope.allowedBranches] };
  }

  if (scope.allowedBranches.includes(uiBranchValue)) {
    return { branch: uiBranchValue };
  }

  return { branchesIn: [] };
}
