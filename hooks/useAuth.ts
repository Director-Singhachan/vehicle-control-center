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
    isAdmin: store.profile?.role === 'admin',
    isManager: store.profile?.role === 'manager' || store.profile?.role === 'admin',
    isInspector: store.profile?.role === 'inspector' || store.profile?.role === 'manager' || store.profile?.role === 'admin',
    isExecutive: store.profile?.role === 'executive' || store.profile?.role === 'admin',
    signIn: store.signIn,
    signOut: store.signOut,
    refreshProfile: store.refreshProfile,
    refetch: store.initialize,
  };
};

