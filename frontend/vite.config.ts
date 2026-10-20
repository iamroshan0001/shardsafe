import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Safely parse API target - fallback to localhost if not set or invalid
  let apiTarget = 'http://localhost:5000';
  const envApiUrl = env.VITE_API_URL;
  if (envApiUrl && envApiUrl.startsWith('http')) {
    apiTarget = envApiUrl;
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
    },
  };
});
