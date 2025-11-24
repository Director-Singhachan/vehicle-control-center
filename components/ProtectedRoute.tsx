// Protected Route - Route guard with role-based access control
import React from 'react';
import { useAuth } from '../hooks';
import { LoginView } from '../views/LoginView';
import { AlertCircle, Shield } from 'lucide-react';
import { Card } from './ui/Card';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'inspector' | 'manager' | 'executive' | 'admin';
  requiredRoles?: ('user' | 'inspector' | 'manager' | 'executive' | 'admin')[];
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredRoles,
  fallback,
}) => {
  const { user, profile, loading, error, isAuthenticated, isAdmin, isManager, isInspector } = useAuth();
  const [showTimeout, setShowTimeout] = React.useState(false);

  // Debug logging
  React.useEffect(() => {
    console.log('[ProtectedRoute] State:', {
      hasUser: !!user,
      hasProfile: !!profile,
      loading,
      isAuthenticated,
      error: error?.message,
      profileRole: profile?.role,
    });
  }, [user, profile, loading, isAuthenticated, error]);

  // Timeout fallback - if loading takes too long, show login
  React.useEffect(() => {
    if (loading && !user && !isAuthenticated) {
      const timeout = setTimeout(() => {
        console.warn('[ProtectedRoute] Loading timeout after 5s - showing login');
        setShowTimeout(true);
      }, 5000);
      return () => clearTimeout(timeout);
    } else {
      setShowTimeout(false);
    }
  }, [loading, user, isAuthenticated]);

  // Show error state if Supabase config is missing
  if (error && (error.message.includes('environment variables') || error.message.includes('not configured'))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-charcoal-950 px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            ต้องตั้งค่า Supabase
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            กรุณาสร้างไฟล์ <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">.env.local</code> และกรอก Supabase credentials
          </p>
          <div className="text-left bg-slate-50 dark:bg-slate-900 p-4 rounded-lg mb-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ไฟล์ .env.local:</p>
            <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
            </pre>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ดูคู่มือ: <code className="text-enterprise-600 dark:text-neon-blue">QUICK_START.md</code>
          </p>
        </Card>
      </div>
    );
  }

  // Show loading state only if we truly don't have user yet
  if (loading && !user && !isAuthenticated && !showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-enterprise-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">กำลังโหลด...</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">หากใช้เวลานานเกิน 5 วินาที จะแสดงหน้า login</p>
        </div>
      </div>
    );
  }

  // If timeout, show login page instead of infinite loading
  if (showTimeout && !user && !isAuthenticated) {
    console.warn('[ProtectedRoute] Timeout reached - showing login page');
    return <LoginView />;
  }

  // Not authenticated - show login
  if (!user) {
    return <LoginView />;
  }

  // If we have user, show app even if profile is still loading
  // Profile will load in background and update when ready
  // This prevents infinite loading when profile fetch is slow
  if (user && !profile) {
    console.log('[ProtectedRoute] User exists but profile not loaded yet - showing app anyway');
    // Continue to show app - profile will load in background
  }

  // Check role requirements
  if (requiredRole || requiredRoles) {
    const roles = requiredRoles || (requiredRole ? [requiredRole] : []);
    const userRole = profile?.role;

    const hasAccess = roles.some(role => {
      switch (role) {
        case 'admin':
          return isAdmin;
        case 'manager':
          return isManager;
        case 'inspector':
          return isInspector;
        case 'executive':
          return userRole === 'executive' || isAdmin;
        case 'user':
          return true; // All authenticated users
        default:
          return false;
      }
    });

    if (!hasAccess) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-charcoal-950 px-4">
          <Card className="w-full max-w-md p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
              <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              ไม่มีสิทธิ์เข้าถึง
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              คุณไม่มีสิทธิ์เข้าถึงหน้านี้
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              บทบาทปัจจุบัน: {profile?.role || 'ไม่ระบุ'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              บทบาทที่ต้องการ: {roles.join(', ')}
            </p>
          </Card>
        </div>
      );
    }
  }

  // User is authenticated and has required role
  return <>{children}</>;
};
