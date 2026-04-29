/** @type {import('tailwindcss').Config} */

/** จาก utils/tripPlanningRouteColors.ts — split เป็น token เพื่อ safelist JIT ให้คลาส dynamic dark: ไม่หลุด */
const TRIP_ROUTE_PALETTE_ROWS = [
  'bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-950/35 dark:border-amber-800 dark:text-amber-100',
  'bg-emerald-100 border-emerald-200 text-emerald-900 dark:bg-emerald-950/35 dark:border-emerald-800 dark:text-emerald-100',
  'bg-sky-100 border-sky-200 text-sky-900 dark:bg-sky-950/35 dark:border-sky-800 dark:text-sky-100',
  'bg-rose-100 border-rose-200 text-rose-900 dark:bg-rose-950/35 dark:border-rose-800 dark:text-rose-100',
  'bg-violet-100 border-violet-200 text-violet-900 dark:bg-violet-950/35 dark:border-violet-800 dark:text-violet-100',
  'bg-orange-100 border-orange-200 text-orange-900 dark:bg-orange-950/35 dark:border-orange-800 dark:text-orange-100',
  'bg-teal-100 border-teal-200 text-teal-900 dark:bg-teal-950/35 dark:border-teal-800 dark:text-teal-100',
  'bg-lime-100 border-lime-200 text-lime-900 dark:bg-lime-950/35 dark:border-lime-800 dark:text-lime-100',
]

const tripPlanningRouteSafelist = [...new Set(TRIP_ROUTE_PALETTE_ROWS.flatMap((row) => row.trim().split(/\s+/)))]

export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: tripPlanningRouteSafelist,
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        enterprise: {
          50: '#f5f3ff', // violet-50
          100: '#ede9fe', // violet-100
          500: '#8b5cf6', // violet-500
          600: '#7c3aed', // violet-600
          900: '#4c1d95', // violet-900
        },
        charcoal: {
          800: '#1e1b4b', // indigo-950 (Deep Blue/Black)
          900: '#0f172a', // slate-900
          950: '#020617', // slate-950 (Deep Space)
        },
        neon: {
          blue: '#38bdf8', // sky-400 (Bright Cyan)
          green: '#34d399', // emerald-400
          alert: '#f472b6', // pink-400
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        // ⚠️ ห้ามใช้ transform (translateY, scale, etc.) ใน keyframes นี้!
        // เพราะ CSS transform จะสร้าง new containing block
        // ซึ่งทำให้ position: sticky ของ element ลูกทั้งหมดภายในพัง
        // PageLayout ใช้ animate-fade-in — ถ้าใส่ transform ตรงนี้
        // sticky bar ของทุกหน้าจะไม่ทำงาน
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}

