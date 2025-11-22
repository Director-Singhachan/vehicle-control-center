import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: 'localhost', // Changed from '0.0.0.0' to 'localhost' for better WebSocket compatibility
        strictPort: false, // Allow Vite to use next available port if 3000 is taken
        open: true, // Open in external browser (not IDE embedded browser) - allows F12 DevTools
        // Disable HMR to avoid WebSocket connection issues
        // App will still work, but you need to manually refresh when code changes
        hmr: false,
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
        include: ['react', 'react-dom'],
        esbuildOptions: {
          target: 'es2020',
        },
      },
      build: {
        target: 'es2020',
        commonjsOptions: {
          transformMixedEsModules: true,
        },
      },
    };
});
