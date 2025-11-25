// Login View - Authentication page
import React, { useState } from 'react';
import { useAuth } from '../hooks';
import { LogIn, Mail, Lock, AlertCircle, RefreshCw, Phone } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { signIn, loading, error } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!identifier || !password) {
      setLocalError('กรุณากรอกอีเมล/เบอร์โทรศัพท์ และรหัสผ่าน');
      return;
    }

    try {
      let emailToUse = identifier.trim();

      // Check if input is a phone number (digits only, 9-10 digits)
      const phoneRegex = /^[0-9]{9,10}$/;
      if (phoneRegex.test(emailToUse)) {
        // Append domain for driver login
        emailToUse = `${emailToUse}@driver.local`;
      }

      await signIn(emailToUse, password);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setLocalError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
  };

  // Filter out session-related errors (normal when not logged in)
  const displayError = localError || (error?.message && !error.message.includes('session') && !error.message.includes('JWT') && !error.message.includes('Auth session missing') ? error.message : null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-charcoal-950 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-enterprise-100 dark:bg-enterprise-900 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-enterprise-600 dark:text-enterprise-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            เข้าสู่ระบบ
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            ศูนย์ควบคุมยานพาหนะ
          </p>
        </div>

        {displayError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{displayError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              อีเมล หรือ เบอร์โทรศัพท์
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400 z-10 pointer-events-none">
                {/^[0-9]+$/.test(identifier) ? <Phone className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
              </div>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="อีเมล หรือ เบอร์โทรศัพท์ (สำหรับคนขับ)"
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 z-10 pointer-events-none" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                เข้าสู่ระบบ
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ</p>
        </div>
      </Card>
    </div>
  );
};

