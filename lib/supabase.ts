/// <reference types="vite/client" />
// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

// Get these values from your Supabase project settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Debug: Log environment variables (without exposing full key)
if (typeof window !== 'undefined') {
  console.log('[Supabase Config] URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ NOT SET');
  console.log('[Supabase Config] Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : '❌ NOT SET');
  console.log('[Supabase Config] All env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
}

// Validate environment variables
let supabaseConfigError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://your-project-id.supabase.co' || supabaseAnonKey === 'your-anon-key-here') {
  const errorMessage = `
⚠️ Missing Supabase environment variables!

Please create a .env.local file in the project root with:
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

Get these values from: https://app.supabase.com/project/_/settings/api

After creating the file, restart the dev server.

See QUICK_START.md for detailed instructions.
  `.trim();

  console.error(errorMessage);
  supabaseConfigError = 'Supabase environment variables are not configured. Please create .env.local file.';

  // Don't throw error here - let the app show error message in UI
  // This prevents infinite loading
}

// Create the Supabase client with better error handling
// Use singleton pattern to prevent multiple instances
let supabaseInstance: any = null;

export const supabase = (() => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Use dummy values if config is missing to prevent crash
  const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
  const safeKey = supabaseAnonKey || 'placeholder-key';

  supabaseInstance = createClient<Database>(safeUrl, safeKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'vehicle-control-center-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-client-info': 'vehicle-control-center',
      },
    },
    db: {
      schema: 'public',
    },
  }) as any;

  return supabaseInstance;
})();

// Helper function to get current user
// Uses getSession() for fast local storage read instead of getUser() which makes API call
export const getCurrentUser = async () => {
  if (supabaseConfigError) {
    // Return null instead of throwing to prevent infinite loading
    console.warn('Supabase config error - returning null user');
    return null;
  }

  // Check if Supabase URL is placeholder (indicates missing config)
  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
    console.warn('Supabase using placeholder config - returning null user');
    return null;
  }

  try {

    // Use getSession() - reads from localStorage (FAST!)
    // Instead of getUser() which makes API call (SLOW - can timeout)
    // Add timeout to prevent hanging
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: any }, error: any }>((resolve) => {
      setTimeout(() => {
        console.warn('getSession timeout in getCurrentUser after 5s');
        resolve({ data: { session: null }, error: new Error('Session check timeout') });
      }, 5000);
    });

    const { data: { session }, error: sessionError } = await Promise.race([getSessionPromise, timeoutPromise]);

    if (sessionError) {
      // "Auth session missing" is normal when user is not logged in
      if (sessionError.message.includes('session') || sessionError.message.includes('JWT') || sessionError.message.includes('Auth session missing')) {
        return null; // User is not authenticated, return null instead of throwing
      }
      // For other errors, log but return null to prevent infinite loading
      console.warn('Session error:', sessionError.message);
      return null;
    }

    return session?.user ?? null;
  } catch (err) {
    // Check for connection errors
    if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
      console.warn('Connection error - returning null user');
      return null; // Return null instead of throwing to prevent infinite loading
    }
    // If it's a session-related error, just return null (user not logged in)
    if (err instanceof Error && (err.message.includes('session') || err.message.includes('JWT'))) {
      return null;
    }
    // For any other error, return null to prevent infinite loading
    console.warn('Unexpected auth error:', err);
    return null;
  }
};

// Helper function to get current user profile
export const getCurrentProfile = async () => {
  if (supabaseConfigError) {
    console.warn('Supabase config error - returning null profile');
    return null;
  }

  const user = await getCurrentUser();
  if (!user) return null;

  // Add timeout to prevent hanging (10 seconds for profile fetch - increased from 5s)
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.warn('Profile fetch timeout after 10s - returning null');
      resolve(null);
    }, 10000);
  });

  try {
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const result = await Promise.race([profilePromise, timeoutPromise]);

    // If timeout, return null
    if (result === null) {
      return null;
    }

    const { data, error } = result as any;

    if (error) {
      // Check for connection errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        console.warn('Connection error fetching profile - returning null');
        return null;
      }
      // "No rows returned" is normal if profile doesn't exist yet
      if (error.code === 'PGRST116' || error.message.includes('No rows')) {
        console.warn('Profile not found for user - returning null');
        return null;
      }
      console.warn('Error fetching profile:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    // Check for connection errors
    if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
      console.warn('Connection error fetching profile - returning null');
      return null;
    }
    console.warn('Unexpected error fetching profile:', err);
    return null;
  }
};

// Export error for UI to check
export const getSupabaseConfigError = () => supabaseConfigError;

