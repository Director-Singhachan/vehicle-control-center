// Custom hook for authentication - Now uses Zustand store for better performance
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const store = useAuthStore();

  // Initialize on first mount if not already initialized
  useEffect(() => {
    if (!store.initialized) {
      store.initialize();
    }
  }, [store.initialized]);

  return {
    user: store.user,
    profile: store.profile,
    loading: store.loading,
    error: store.error,
    isAuthenticated: !!store.user,
    isAdmin: store.isAdmin,
    isManager: store.isManager,
    isInspector: store.isInspector,
    isExecutive: store.isExecutive,
    isDriver: store.isDriver,
    isSales: store.isSales,
    isServiceStaff: store.isServiceStaff,
    isHR: store.isHR,
    isAccounting: store.isAccounting,
    isWarehouse: store.isWarehouse,
    isReadOnly: store.isReadOnly,
    isDev: store.isDev,
    overriddenRole: store.overriddenRole,
    setOverriddenRole: store.setOverriddenRole,
    signIn: store.signIn,
    signOut: store.signOut,
    refreshProfile: store.refreshProfile,
    refetch: store.initialize,
  };
};
