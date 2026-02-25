/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
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

