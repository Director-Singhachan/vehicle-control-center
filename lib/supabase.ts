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

// Helper function to get session from localStorage directly (fast, no network call)
const getSessionFromStorage = (): { data: { session: any }; error: any } | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const storageKey = 'vehicle-control-center-auth';
    const stored = window.localStorage.getItem(storageKey);
    
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    const session = parsed?.currentSession || parsed?.session || null;
    
    // Check if session is expired
    if (session?.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      if (Date.now() > expiresAt) {
        return null; // Session expired
      }
    }
    
    return { data: { session }, error: null };
  } catch (err) {
    console.warn('[getSessionFromStorage] Error reading from localStorage:', err);
    return null;
  }
};

// Helper function to get current user
// Uses localStorage directly first (FAST!), then falls back to getSession() if needed
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
    // Try localStorage first (FAST - no network call, no timeout risk)
    const storageResult = getSessionFromStorage();
    if (storageResult?.data?.session?.user) {
      console.log('[getCurrentUser] Using session from localStorage (fast path)');
      return storageResult.data.session.user;
    }

    // Fallback to getSession() with shorter timeout (2s instead of 5s)
    // This should rarely be needed if localStorage has valid session
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: any }, error: any }>((resolve) => {
      setTimeout(() => {
        if (import.meta.env.DEV) {
          console.warn('getSession timeout in getCurrentUser after 2s - using localStorage fallback');
        }
        // Try localStorage one more time as fallback
        const fallback = getSessionFromStorage();
        resolve(fallback || { data: { session: null }, error: new Error('Session check timeout') });
      }, 2000); // Reduced from 5s to 2s
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
      console.warn('Connection error - trying localStorage fallback');
      // Try localStorage as last resort
      const fallback = getSessionFromStorage();
      return fallback?.data?.session?.user ?? null;
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

  // Add timeout to prevent hanging (reduced to 5 seconds, with retry logic)
  const fetchWithRetry = async (retries = 2): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            if (import.meta.env.DEV) {
              if (attempt < retries) {
                console.warn(`Profile fetch timeout after 5s (attempt ${attempt + 1}/${retries + 1}) - retrying...`);
              } else {
                console.warn('Profile fetch timeout after 5s - all retries exhausted, returning null');
              }
            }
            resolve(null);
          }, 5000); // Reduced from 10s to 5s
        });

        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const result = await Promise.race([profilePromise, timeoutPromise]);

        // If timeout and we have retries left, continue loop
        if (result === null && attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          continue;
        }

        // If timeout and no retries left, return null
        if (result === null) {
          return null;
        }

        const { data, error } = result as any;

        if (error) {
          // Check for connection errors - retry if we have attempts left
          if ((error.message.includes('fetch') || error.message.includes('network')) && attempt < retries) {
            console.warn(`Connection error fetching profile (attempt ${attempt + 1}/${retries + 1}) - retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
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
        // Check for connection errors - retry if we have attempts left
        if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network')) && attempt < retries) {
          console.warn(`Connection error fetching profile (attempt ${attempt + 1}/${retries + 1}) - retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        // If last attempt, return null
        if (attempt === retries) {
          console.warn('Unexpected error fetching profile:', err);
          return null;
        }
      }
    }
    return null;
  };

  return fetchWithRetry();
};

// Export error for UI to check
export const getSupabaseConfigError = () => supabaseConfigError;

