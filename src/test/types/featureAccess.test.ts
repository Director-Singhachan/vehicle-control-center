import { describe, expect, it } from 'vitest';
import {
  accessLevelAtLeast,
  builtInLevel,
  builtInMatrixForRole,
  isPrivilegedRole,
  resolveAccessLevel,
} from '../../../types/featureAccess';

describe('featureAccess', () => {
  it('accessLevelAtLeast orders levels', () => {
    expect(accessLevelAtLeast('manage', 'view')).toBe(true);
    expect(accessLevelAtLeast('view', 'edit')).toBe(false);
    expect(accessLevelAtLeast('edit', 'edit')).toBe(true);
  });

  it('admin and hr are privileged with manage on any feature', () => {
    expect(isPrivilegedRole('admin')).toBe(true);
    expect(isPrivilegedRole('hr')).toBe(true);
    expect(builtInLevel('admin', 'tab.reports')).toBe('manage');
    expect(builtInLevel('hr', 'report.pnl_fleet')).toBe('manage');
  });

  it('manager has no admin_staff by default', () => {
    expect(builtInLevel('manager', 'tab.admin_staff')).toBe('none');
  });

  it('resolveAccessLevel prefers DB override', () => {
    expect(resolveAccessLevel('manager', 'tab.admin_staff', 'view')).toBe('view');
    expect(resolveAccessLevel('manager', 'tab.admin_staff', undefined)).toBe('none');
  });

  it('builtInMatrixForRole returns all keys', () => {
    const m = builtInMatrixForRole('driver');
    expect(m['tab.triplogs']).toBe('manage');
    expect(m['tab.reports']).toBe('none');
  });
});
