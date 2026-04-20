/**
 * Design Tokens - มาตรฐานการออกแบบสำหรับทั้งแอปพลิเคชัน
 * ใช้ค่าจากไฟล์นี้เพื่อให้ UI สอดคล้องกันทุกหน้า
 */

export const colors = {
  // Enterprise (Now Violet/Indigo for Modern AI)
  enterprise: {
    50: '#f5f3ff',
    100: '#ede9fe',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    900: '#4c1d95',
  },
  // Dark Mode Backgrounds (Deep Space)
  charcoal: {
    800: '#1e1b4b',
    900: '#0f172a',
    950: '#020617',
  },
  // Neon Accents
  neon: {
    blue: '#38bdf8',
    green: '#34d399',
    alert: '#f472b6',
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
    light: '#34d399',
    dark: '#059669',
  },
  error: {
    light: '#f472b6',
    dark: '#be123c',
  },
  warning: {
    light: '#fbbf24',
    dark: '#b45309',
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
  glow: '0 0 15px rgba(139, 92, 246, 0.5)', // Violet glow
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
    base: 'bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 shadow-sm',
    hover: 'hover:shadow-glow hover:border-enterprise-500/50 transition-all duration-300',
    padding: 'p-6',
  },
  button: {
    primary: 'bg-enterprise-600 hover:bg-enterprise-700 text-white shadow-lg shadow-enterprise-600/30',
    secondary: 'bg-slate-100 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-transparent hover:border-slate-300 dark:hover:border-slate-600',
    outline: 'border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300',
    base: 'px-4 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95',
  },
  input: {
    base: 'w-full px-4 py-2 bg-white/50 dark:bg-charcoal-900/50 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500 dark:focus:ring-enterprise-400 transition-all duration-200',
  },
  pageHeader: {
    title: 'text-2xl font-bold text-slate-900 dark:text-white tracking-tight',
    subtitle: 'text-sm text-slate-500 dark:text-slate-400',
  },
};

