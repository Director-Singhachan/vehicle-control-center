// Auth Store - Global state management for authentication
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getCurrentProfile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  initialized: boolean;

  // Computed properties
  isAdmin: boolean;
  isManager: boolean;
  isInspector: boolean;
  isExecutive: boolean;
  isDriver: boolean;
  isSales: boolean;
  isServiceStaff: boolean;
  isHR: boolean;
  isAccounting: boolean;
  isWarehouse: boolean;
  isReadOnly: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setInitialized: (initialized: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: false,
      error: null,
      initialized: false,

      // Computed properties (initial values, updated via setProfile)
      isAdmin: false,
      isManager: false,
      isInspector: false,
      isExecutive: false,
      isDriver: false,
      isSales: false,
      isServiceStaff: false,
      isHR: false,
      isAccounting: false,
      isWarehouse: false,
      isReadOnly: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => {
        set({
          profile,
          isAdmin: profile?.role === 'admin',
          isManager: profile?.role === 'manager',
          isInspector: profile?.role === 'inspector',
          isExecutive: profile?.role === 'executive',
          isDriver: profile?.role === 'driver',
          isSales: profile?.role === 'sales',
          isServiceStaff: profile?.role === 'service_staff',
          isHR: profile?.role === 'hr',
          isAccounting: profile?.role === 'accounting',
          isWarehouse: profile?.role === 'warehouse',
          isReadOnly: profile?.role === 'user',
        });
      },
      setAvailableStaff: (staff) => set({ availableStaff: staff }),
      setActiveStaff: (staff) => set({ activeStaff: staff }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setInitialized: (initialized) => set({ initialized }),

      initialize: async () => {
        const state = get();

        if (state.user && state.profile) {
          // Re-compute flags to ensure they match profile
          const profile = state.profile;
          set({
            initialized: true,
            loading: false,
            isAdmin: profile.role === 'admin',
            isManager: profile.role === 'manager',
            isInspector: profile.role === 'inspector',
            isExecutive: profile.role === 'executive',
            isDriver: profile.role === 'driver',
            isSales: profile.role === 'sales',
            isServiceStaff: profile.role === 'service_staff',
            isHR: profile.role === 'hr',
            isAccounting: profile.role === 'accounting',
            isWarehouse: profile.role === 'warehouse',
            isReadOnly: profile.role === 'user',
          });
          console.log('[Auth] Using cached data, verifying session in background...');
        } else {
          set({ loading: true, error: null });
        }

        try {
          if (!supabase || !supabase.auth) {
            console.warn('[Auth] Supabase client not available');
            set({ user: null, profile: null, initialized: true, loading: false });
            return;
          }

          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.warn('[Auth] Session error:', sessionError);
            set({ user: null, profile: null, initialized: true, loading: false });
            return;
          }

          const user = session?.user ?? null;
          set({ user, initialized: true });

          if (user) {
            try {
              console.log('[Auth] Fetching profile for user:', user.id);
              getCurrentProfile().then(async (profile) => {
                console.log('[Auth] Profile fetched:', profile ? `role: ${profile.role}, shared: ${profile.is_shared_account}` : 'null');
                get().setProfile(profile);

                if (profile?.is_shared_account) {
                  console.log('[Auth] Shared account detected. Fetching available staff...');
                  const { data: staff, error: staffError } = await supabase
                    .from('service_staff')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'active');
                  
                  if (staffError) {
                    console.error('[Auth] Error fetching staff for shared account:', staffError);
                    get().setAvailableStaff([]);
                  } else {
                    console.log(`[Auth] Found ${staff.length} active staff profiles.`);
                    get().setAvailableStaff(staff || []);
                  }
                } else {
                  get().setAvailableStaff([]);
                  get().setActiveStaff(null);
                }

                set({ loading: false });
              }).catch(err => {
                console.warn('[Auth] Failed to fetch profile:', err);
                get().setProfile(null);
                set({ loading: false });
              });
            } catch (err) {
              console.warn('[Auth] Failed to fetch profile:', err);
              get().setProfile(null);
              set({ loading: false });
            }
          } else {
            get().setProfile(null);
            set({ loading: false });
          }
        } catch (err) {
          console.error('[Auth] Initialize error:', err);
          set({ user: null, profile: null, initialized: true, loading: false });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) throw signInError;

          set({ user: data.user, initialized: true });

          if (data.user) {
            try {
              const profile = await getCurrentProfile();
              get().setProfile(profile);

              if (profile?.is_shared_account) {
                console.log('[Auth] Shared account detected. Fetching available staff...');
                const { data: staff, error: staffError } = await supabase
                  .from('service_staff')
                  .select('*')
                  .eq('user_id', data.user.id)
                  .eq('status', 'active');
                
                if (staffError) {
                  console.error('[Auth] Error fetching staff for shared account:', staffError);
                  get().setAvailableStaff([]);
                } else {
                  console.log(`[Auth] Found ${staff.length} active staff profiles.`);
                  get().setAvailableStaff(staff || []);
                }
              } else {
                  get().setAvailableStaff([]);
                  get().setActiveStaff(null);
              }

            } catch (profileErr) {
              console.error('[Auth] Failed to fetch profile after sign in:', profileErr);
              get().setProfile(null);
            }
          } else {
            get().setProfile(null);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to sign in');
          set({ error });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        set({ loading: true, error: null });
        try {
          // Best-effort sign out on server, but never block local logout
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
              console.warn('[Auth] Error checking session before sign out:', sessionError);
            }

            if (session) {
              // Use local scope to avoid global logout 403s; ignore any errors
              const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

              if (signOutError) {
                console.warn('[Auth] Sign out error (ignored, logging out locally):', signOutError.message);
              }
            } else {
              console.log('[Auth] No active session found during sign out, clearing local auth state');
            }
          } catch (innerErr) {
            console.warn('[Auth] Unexpected error during remote sign out (ignored):', innerErr);
          }

          // Always clear local auth state so UI/logical logout always works
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              // Clear Supabase auth storage explicitly
              window.localStorage.removeItem('vehicle-control-center-auth');
            }
          } catch (storageErr) {
            console.warn('[Auth] Failed to clear local auth storage (ignored):', storageErr);
          }

          set({
            user: null,
            profile: null,
            availableStaff: [],
            activeStaff: null,
            initialized: false,
            isAdmin: false,
            isManager: false,
            isInspector: false,
            isExecutive: false,
            isDriver: false,
            isSales: false,
            isServiceStaff: false,
            isHR: false,
            isAccounting: false,
            isWarehouse: false,
            isReadOnly: false,
          });
        } finally {
          set({ loading: false });
        }
      },

      refreshProfile: async () => {
        try {
          const user = get().user;
          if (!user) {
            get().setProfile(null);
            return;
          }

          const profile = await getCurrentProfile();
          get().setProfile(profile);
        } catch (err) {
          console.error('[Auth] Error refreshing profile:', err);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Persist user and profile for instant load
        user: state.user ? { id: state.user.id, email: state.user.email } : null,
        profile: state.profile,
        isAdmin: state.isAdmin,
        isManager: state.isManager,
        isInspector: state.isInspector,
        isExecutive: state.isExecutive,
        isDriver: state.isDriver,
        isSales: state.isSales,
        isServiceStaff: state.isServiceStaff,
        isHR: state.isHR,
        isAccounting: state.isAccounting,
        isWarehouse: state.isWarehouse,
        isReadOnly: state.isReadOnly,
      }),
    }
  )
);

// Initialize auth on store creation
if (typeof window !== 'undefined') {
  try {
    if (!supabase || !supabase.auth) {
      console.warn('[Auth] Supabase client not available - skipping initialization');
      useAuthStore.getState().setInitialized(true);
    } else {
      useAuthStore.getState().initialize();

      supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          const store = useAuthStore.getState();
          store.setUser(session?.user ?? null);
          store.setInitialized(true);

          if (session?.user) {
            try {
              const profile = await getCurrentProfile();
              if (profile) {
                store.setProfile(profile);
                console.log('[Auth] Profile updated:', profile.role);
              } else {
                if (!store.profile) {
                  store.setProfile(null);
                }
              }
            } catch (err) {
              console.error('[Auth] Error fetching profile on auth change:', err);
              if (!store.profile) {
                store.setProfile(null);
              }
            }
          } else {
            store.setProfile(null);
          }
        } catch (err) {
          console.error('[Auth] Error in auth state change handler:', err);
        }
      });
    }
  } catch (err) {
    console.error('[Auth] Failed to initialize auth store:', err);
    useAuthStore.getState().setInitialized(true);
  }
}
