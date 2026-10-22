// Shared Vite/Vitest configuration for local API proxying and component tests.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep browser API calls same-origin during local development.
  server: { proxy: { '/api': 'http://localhost:8080', '/healthz': 'http://localhost:8080' } },
  // Run React tests in jsdom and enforce minimum coverage for the UI module.
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', coverage: { reporter: ['text', 'lcov'], thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 } } },
});
