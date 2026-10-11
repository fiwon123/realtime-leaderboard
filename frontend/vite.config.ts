import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Same-origin requests in dev: the browser talks only to the dev server,
    // which forwards the API routes to the backend on :8080. No CORS needed.
    proxy: {
      '/scores': 'http://localhost:8080',
      '/leaderboard': 'http://localhost:8080',
      '/players': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
