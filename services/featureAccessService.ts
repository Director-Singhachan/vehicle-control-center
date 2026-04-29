import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/database';
import type { AccessLevel, FeatureKey } from '../types/featureAccess';
import { FEATURE_KEYS } from '../types/featureAccess';

export interface RoleFeatureRow {
  role: AppRole;
  feature_key: string;
  access_level: AccessLevel;
}

export async function fetchRoleFeatureMatrix(role: AppRole): Promise<RoleFeatureRow[]> {
  const { data, error } = await supabase
    .from('role_feature_access')
    .select('role, feature_key, access_level')
    .eq('role', role)
    .order('feature_key');

  if (error) throw error;
  return (data ?? []) as RoleFeatureRow[];
}

/** โหลดทุกแถว (เฉพาะ admin ผ่าน RLS) */
export async function fetchFullFeatureMatrix(): Promise<RoleFeatureRow[]> {
  const { data, error } = await supabase
    .from('role_feature_access')
    .select('role, feature_key, access_level')
    .order('role')
    .order('feature_key');

  if (error) throw error;
  return (data ?? []) as RoleFeatureRow[];
}

export async function upsertRoleFeatureAccess(
  role: AppRole,
  rows: { feature_key: FeatureKey; access_level: AccessLevel }[],
): Promise<void> {
  const payload = rows.map((r) => ({
    role,
    feature_key: r.feature_key,
    access_level: r.access_level,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('role_feature_access').upsert(payload, {
    onConflict: 'role,feature_key',
  });

  if (error) throw error;
}

export async function upsertSingleRoleFeature(
  role: AppRole,
  feature_key: FeatureKey,
  access_level: AccessLevel,
): Promise<void> {
  const { error } = await supabase.from('role_feature_access').upsert(
    {
      role,
      feature_key,
      access_level,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'role,feature_key' },
  );
  if (error) throw error;
}

/** ลบ overrides ในฐานข้อมูล — กลับไปใช้ค่า built-in ในแอป */
export async function clearRoleFeatureOverrides(role: AppRole): Promise<void> {
  const { error } = await supabase.from('role_feature_access').delete().eq('role', role);
  if (error) throw error;
}

export function getAllFeatureKeys(): FeatureKey[] {
  return [...FEATURE_KEYS];
}

export const APP_ROLES: AppRole[] = [
  'user',
  'inspector',
  'manager',
  'executive',
  'admin',
  'driver',
  'sales',
  'service_staff',
  'hr',
  'accounting',
  'warehouse',
  'dev',
];
