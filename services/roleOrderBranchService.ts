import { supabase } from '../lib/supabase';
import type { AppRole, Database } from '../types/database';

export type OrderBranchVisibility = Database['public']['Enums']['order_branch_visibility'];
export type RoleOrderBranchScopeRow = Database['public']['Tables']['role_order_branch_scope']['Row'];

/** โหลดทุกแถวของบทบาทนั้น (admin ผ่าน RLS) */
export async function fetchScopesForRole(role: AppRole): Promise<RoleOrderBranchScopeRow[]> {
  const { data, error } = await supabase
    .from('role_order_branch_scope')
    .select('*')
    .eq('role', role)
    .order('profile_branch');

  if (error) throw error;
  return data ?? [];
}

export async function upsertRoleOrderBranchScope(
  role: AppRole,
  profileBranch: string,
  visibility: OrderBranchVisibility,
): Promise<void> {
  const { error } = await supabase.from('role_order_branch_scope').upsert(
    {
      role,
      profile_branch: profileBranch,
      visibility,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'role,profile_branch' },
  );
  if (error) throw error;
}

export async function deleteRoleOrderBranchScope(role: AppRole, profileBranch: string): Promise<void> {
  const { error } = await supabase
    .from('role_order_branch_scope')
    .delete()
    .eq('role', role)
    .eq('profile_branch', profileBranch);
  if (error) throw error;
}
