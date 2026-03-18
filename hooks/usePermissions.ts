import { useMemo } from 'react';
import { useAuth } from './useAuth';
import type { AppRole } from '../types/database';
import type { BusinessRole } from '../types/permissions';
import { APP_ROLE_TO_BUSINESS_ROLE } from '../types/permissions';

interface UsePermissionsResult {
  appRole: AppRole | null;
  businessRole: BusinessRole | null;
  canViewTripPnl: boolean;
  canViewVehiclePnl: boolean;
  canViewFleetPnl: boolean;
}

export const usePermissions = (): UsePermissionsResult => {
  const { profile } = useAuth();

  const appRole = (profile?.role as AppRole) ?? null;

  const businessRole = useMemo<BusinessRole | null>(() => {
    if (!appRole) return null;
    return APP_ROLE_TO_BUSINESS_ROLE[appRole] ?? null;
  }, [appRole]);

  const { canViewTripPnl, canViewVehiclePnl, canViewFleetPnl } = useMemo(() => {
    switch (businessRole) {
      case 'ROLE_OPERATION_USER':
        return { canViewTripPnl: true, canViewVehiclePnl: false, canViewFleetPnl: false };
      case 'ROLE_BRANCH_MANAGER':
        return { canViewTripPnl: true, canViewVehiclePnl: true, canViewFleetPnl: false };
      case 'ROLE_TOP_MANAGEMENT':
        return { canViewTripPnl: false, canViewVehiclePnl: false, canViewFleetPnl: true };
      case 'ROLE_PURCHASING_USER':
      case 'ROLE_HR_USER':
        return { canViewTripPnl: false, canViewVehiclePnl: false, canViewFleetPnl: false };
      case 'ROLE_SYSTEM_ADMIN':
        return { canViewTripPnl: true, canViewVehiclePnl: true, canViewFleetPnl: true };
      default:
        return { canViewTripPnl: false, canViewVehiclePnl: false, canViewFleetPnl: false };
    }
  }, [businessRole]);

  return {
    appRole,
    businessRole,
    canViewTripPnl,
    canViewVehiclePnl,
    canViewFleetPnl,
  };
};

