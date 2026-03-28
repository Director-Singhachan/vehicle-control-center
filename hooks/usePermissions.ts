import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useFeatureAccess } from './useFeatureAccess';
import type { AppRole } from '../types/database';
import type { BusinessRole } from '../types/permissions';
import { APP_ROLE_TO_BUSINESS_ROLE } from '../types/permissions';
import { accessLevelAtLeast } from '../types/featureAccess';

interface UsePermissionsResult {
  appRole: AppRole | null;
  businessRole: BusinessRole | null;
  canViewTripPnl: boolean;
  canViewVehiclePnl: boolean;
  canViewFleetPnl: boolean;
}

export const usePermissions = (): UsePermissionsResult => {
  const { profile } = useAuth();
  const { levelFor } = useFeatureAccess();

  const appRole = (profile?.role as AppRole) ?? null;

  const businessRole = useMemo<BusinessRole | null>(() => {
    if (!appRole) return null;
    return APP_ROLE_TO_BUSINESS_ROLE[appRole] ?? null;
  }, [appRole]);

  const { canViewTripPnl, canViewVehiclePnl, canViewFleetPnl } = useMemo(() => {
    return {
      canViewTripPnl: accessLevelAtLeast(levelFor('report.pnl_trip'), 'view'),
      canViewVehiclePnl: accessLevelAtLeast(levelFor('report.pnl_vehicle'), 'view'),
      canViewFleetPnl: accessLevelAtLeast(levelFor('report.pnl_fleet'), 'view'),
    };
  }, [levelFor]);

  return {
    appRole,
    businessRole,
    canViewTripPnl,
    canViewVehiclePnl,
    canViewFleetPnl,
  };
};
