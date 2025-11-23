// Auth Store - Global state management for authentication
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getCurrentUser, getCurrentProfile } from '../lib/supabase';
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

        // If we have cached data, return immediately! (No blocking)
        if (state.initialized && state.user && state.profile) {
          // Background refresh (non-blocking) - fire and forget
          setTimeout(() => {
            get().refreshProfile();
          }, 100);
          return;
        }

        // Only set loading if we don't have profile yet
        if (!state.profile && !state.loading) {
          set({ loading: true, error: null });
        }

        try {
          const user = await getCurrentUser();
          set({ user, initialized: true });

          if (user) {
            try {
              // Always fetch fresh profile
              const profile = await getCurrentProfile();
              set({ profile, loading: false });
            } catch (err) {
              console.warn('Failed to fetch profile:', err);
              set({ profile: null, loading: false });
            }
          } else {
            set({ profile: null, loading: false });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize auth';
          // Don't set error for session-related messages
          if (!errorMessage.includes('session') && !errorMessage.includes('JWT')) {
            set({ error: new Error(errorMessage) });
          }
          set({ loading: false });
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

          // Always fetch fresh profile after sign in
          if (data.user) {
            try {
              const profile = await getCurrentProfile();
              set({ profile });
            } catch (profileErr) {
              console.error('Failed to fetch profile after sign in:', profileErr);
              // Don't throw - user is authenticated even if profile fetch fails
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
          console.error('Error refreshing profile:', err);
          // Don't clear profile on error - keep existing one
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Persist user and profile for instant load
        user: state.user ? { id: state.user.id, email: state.user.email } : null,
        profile: state.profile, // Cache profile for instant UI!
      }),
    }
  )
);

// Initialize auth on store creation
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize();

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();

    // Update user
    store.setUser(session?.user ?? null);
    store.setInitialized(true);

    if (session?.user) {
      // Always fetch fresh profile on auth state change
      try {
        const profile = await getCurrentProfile();
        store.setProfile(profile);
        console.log('Profile updated:', profile?.role); // Debug log
      } catch (err) {
        console.error('Error fetching profile on auth change:', err);
        store.setProfile(null);
      }
    } else {
      store.setProfile(null);
    }
  });
}

