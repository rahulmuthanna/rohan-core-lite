import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The browser only ever talks to this dev server. Anything under /api is passed
// on to the backend, so the frontend code never needs to know the backend address.
const apiProxy = {
  '/api': { target: 'http://localhost:4000', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 5173, strictPort: true, proxy: apiProxy },
  test: { include: ['src/**/*.test.ts'] },
});
