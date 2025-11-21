/**
 * Design Tokens - มาตรฐานการออกแบบสำหรับทั้งแอปพลิเคชัน
 * ใช้ค่าจากไฟล์นี้เพื่อให้ UI สอดคล้องกันทุกหน้า
 */

export const colors = {
  // Enterprise Blue (สีหลัก)
  enterprise: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    900: '#0c4a6e',
  },
  // Dark Mode Backgrounds
  charcoal: {
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  // Neon Accents (สำหรับ dark mode)
  neon: {
    blue: '#3b82f6',
    green: '#10b981',
    alert: '#ef4444',
  },
  // Slate (text และ borders)
  slate: {
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  // Status Colors
  success: {
    light: '#10b981',
    dark: '#059669',
  },
  error: {
    light: '#ef4444',
    dark: '#dc2626',
  },
  warning: {
    light: '#f59e0b',
    dark: '#d97706',
  },
};

export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
};

export const borderRadius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  full: '9999px',
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};

export const typography = {
  fontFamily: {
    sans: ['Inter', 'sans-serif'],
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const transitions = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
};

// Component-specific styles
export const componentStyles = {
  card: {
    base: 'bg-white dark:bg-charcoal-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm',
    hover: 'hover:shadow-lg transition-shadow duration-300',
    padding: 'p-6',
  },
  button: {
    primary: 'bg-enterprise-600 hover:bg-enterprise-700 text-white',
    secondary: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white',
    outline: 'border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
    base: 'px-4 py-2 rounded-lg font-medium transition-colors duration-200',
  },
  input: {
    base: 'w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500 dark:focus:ring-neon-blue',
  },
  pageHeader: {
    title: 'text-2xl font-bold text-slate-900 dark:text-white',
    subtitle: 'text-sm text-slate-500 dark:text-slate-400',
  },
};

