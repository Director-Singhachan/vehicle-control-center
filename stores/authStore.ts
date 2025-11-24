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

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setInitialized: (initialized) => set({ initialized }),

      initialize: async () => {
        const state = get();

        // If we have cached data, use it immediately!
        if (state.user && state.profile) {
          set({ initialized: true, loading: false });
          return;
        }

        set({ loading: true, error: null });

        try {
          // Check if supabase client is available
          if (!supabase || !supabase.auth) {
            console.warn('[Auth] Supabase client not available');
            set({ user: null, profile: null, initialized: true, loading: false });
            return;
          }

          // Use getSession() - reads from localStorage (FAST!)
          // Instead of getUser() which makes API call (SLOW - 20s timeout)
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
              // Set loading to false immediately so UI can render
              // Profile will update when fetch completes
              set({ loading: false });
              
              // Fetch profile in background (don't block UI)
              getCurrentProfile().then(profile => {
                console.log('[Auth] Profile fetched:', profile ? `role: ${profile.role}` : 'null');
                set({ profile });
              }).catch(err => {
                console.warn('[Auth] Failed to fetch profile:', err);
                // Don't block UI if profile fetch fails - user can still use app
                set({ profile: null });
              });
            } catch (err) {
              console.warn('[Auth] Failed to fetch profile:', err);
              // Don't block UI if profile fetch fails - user can still use app
              set({ profile: null, loading: false });
            }
          } else {
            set({ profile: null, loading: false });
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

          // Fetch profile after sign in
          if (data.user) {
            try {
              const profile = await getCurrentProfile();
              set({ profile });
            } catch (profileErr) {
              console.error('[Auth] Failed to fetch profile after sign in:', profileErr);
              set({ profile: null });
            }
          } else {
            set({ profile: null });
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
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;

          set({ user: null, profile: null, initialized: false });
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to sign out');
          set({ error });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      refreshProfile: async () => {
        try {
          const user = get().user;
          if (!user) {
            set({ profile: null });
            return;
          }

          const profile = await getCurrentProfile();
          set({ profile });
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
      }),
    }
  )
);

// Initialize auth on store creation
// Wrap in try-catch to prevent 500 errors if module fails to load
if (typeof window !== 'undefined') {
  try {
    // Check if supabase client is available
    if (!supabase || !supabase.auth) {
      console.warn('[Auth] Supabase client not available - skipping initialization');
      useAuthStore.getState().setInitialized(true);
    } else {
      useAuthStore.getState().initialize();

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          const store = useAuthStore.getState();

          // Update  user
          store.setUser(session?.user ?? null);
          store.setInitialized(true);

          if (session?.user) {
            // Fetch fresh profile on auth state change
            try {
              const profile = await getCurrentProfile();
              if (profile) {
                store.setProfile(profile);
                console.log('[Auth] Profile updated:', profile.role);
              } else {
                console.warn('[Auth] Profile not found or timeout - keeping existing profile');
                // Don't set to null if we already have a profile cached
                if (!store.profile) {
                  store.setProfile(null);
                }
              }
            } catch (err) {
              console.error('[Auth] Error fetching profile on auth change:', err);
              // Don't clear profile if we already have one cached
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
    // Set initialized to true to prevent infinite loading
    useAuthStore.getState().setInitialized(true);
  }
}
