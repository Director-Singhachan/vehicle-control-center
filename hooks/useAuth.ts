// Custom hook for authentication
import { useState, useEffect } from 'react';
import { supabase, getCurrentUser, getCurrentProfile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface AuthUser {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAuth = async () => {
    setLoading(true);
    setError(null);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('Auth fetch timeout - assuming no user');
      setLoading(false);
      setUser(null);
      setProfile(null);
    }, 5000); // 5 second timeout
    
    try {
      const currentUser = await getCurrentUser();
      clearTimeout(timeoutId);
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const currentProfile = await getCurrentProfile();
          setProfile(currentProfile);
        } catch (profileErr) {
          // Profile fetch failed, but user is authenticated
          console.warn('Failed to fetch profile:', profileErr);
          setProfile(null);
        }
      } else {
        setProfile(null);
        // No user is normal - user just not logged in, don't set error
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch auth';
      // Don't show error for session-related messages (user just not logged in)
      if (errorMessage.includes('session') || errorMessage.includes('JWT') || errorMessage.includes('Auth session missing')) {
        // User is not authenticated, this is normal - don't set error
        setUser(null);
        setProfile(null);
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Connection') || errorMessage.includes('environment variables')) {
        setError(new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการตั้งค่า Supabase ในไฟล์ .env.local'));
        setUser(null);
        setProfile(null);
      } else {
        setError(new Error(errorMessage));
        setUser(null);
        setProfile(null);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          const currentProfile = await getCurrentProfile();
          setProfile(currentProfile);
        } catch (err) {
          console.error('Error fetching profile:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      setUser(data.user);
      if (data.user) {
        const currentProfile = await getCurrentProfile();
        setProfile(currentProfile);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign in'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata?: { full_name?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (signUpError) throw signUpError;

      setUser(data.user ?? null);
      if (data.user) {
        const currentProfile = await getCurrentProfile();
        setProfile(currentProfile);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign up'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      setUser(null);
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign out'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const currentProfile = await getCurrentProfile();
      setProfile(currentProfile);
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  return {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager' || profile?.role === 'admin',
    isInspector: profile?.role === 'inspector' || profile?.role === 'manager' || profile?.role === 'admin',
    signIn,
    signUp,
    signOut,
    refreshProfile,
    refetch: fetchAuth,
  };
};

