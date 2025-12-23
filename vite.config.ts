import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: 'localhost',
      strictPort: false,
      open: true,
      hmr: true, // เปิด Hot Module Replacement เพื่ออัปเดตไฟล์อัตโนมัติ
      watch: {
        usePolling: false,
      },
    },
    plugins: [
      react({
        jsxRuntime: 'automatic',
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/supabase-js', 'zustand', 'zustand/middleware'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    build: {
      target: 'esnext',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          // เพิ่ม hash ในชื่อไฟล์เพื่อบังคับให้เบราว์เซอร์โหลดไฟล์ใหม่เมื่อมีการเปลี่ยนแปลง
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
    },
  };
});
