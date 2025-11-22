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
  
  // Use dummy values to prevent app crash, but operations will fail gracefully
  // This allows the app to show a proper error message instead of crashing
}

// Create the Supabase client with better error handling
// Use dummy values if config is missing to prevent crash
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
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

// Helper function to get current user
export const getCurrentUser = async () => {
  if (supabaseConfigError) {
    throw new Error(supabaseConfigError);
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // If no user, return null (not an error - user just not logged in)
    if (error) {
      // "Auth session missing" is normal when user is not logged in
      if (error.message.includes('session') || error.message.includes('JWT')) {
        return null; // User is not authenticated, return null instead of throwing
      }
      throw error;
    }
    return user;
  } catch (err) {
    // Check for connection errors
    if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
      throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
    }
    // If it's a session-related error, just return null (user not logged in)
    if (err instanceof Error && (err.message.includes('session') || err.message.includes('JWT'))) {
      return null;
    }
    throw err;
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

