// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

// Get these values from your Supabase project settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  // Use dummy values if config is missing to prevent crash
  const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
  const safeKey = supabaseAnonKey || 'placeholder-key';

  supabaseInstance = createClient(safeUrl, safeKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'vehicle-control-center-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
  });
  
  return supabaseInstance;
})();

// Helper function to get current user
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
  
  // Add timeout to prevent hanging (increased to 10 seconds for slow connections)
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.warn('Auth request timeout after 10s - this may indicate:');
      console.warn('1. Missing or incorrect Supabase credentials in .env.local');
      console.warn('2. Network connection issues');
      console.warn('3. Supabase service is down');
      console.warn('Returning null user - app will show login page');
      resolve(null);
    }, 10000); // Increased from 3s to 10s
  });
  
  try {
    const getUserPromise = supabase.auth.getUser();
    const result = await Promise.race([getUserPromise, timeoutPromise]);
    
    // If timeout, return null
    if (result === null) {
      return null;
    }
    
    const { data: { user }, error } = result as any;
    
    // If no user, return null (not an error - user just not logged in)
    if (error) {
      // "Auth session missing" is normal when user is not logged in
      if (error.message.includes('session') || error.message.includes('JWT') || error.message.includes('Auth session missing')) {
        return null; // User is not authenticated, return null instead of throwing
      }
      // For other errors, log but return null to prevent infinite loading
      console.warn('Auth error:', error.message);
      return null;
    }
    return user;
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
    throw new Error(supabaseConfigError);
  }
  
  const user = await getCurrentUser();
  if (!user) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      // Check for connection errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
      }
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    // Check for connection errors
    if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
      throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
    }
    throw err;
  }
};

// Export error for UI to check
export const getSupabaseConfigError = () => supabaseConfigError;

