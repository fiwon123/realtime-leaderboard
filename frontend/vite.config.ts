import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Where the dev server forwards API requests. Inside the dev sandbox the
// backend runs in the same container on :8080; on a host it is published on
// :8082 by default (8080/8081 belong to sibling projects). Override with
// API_PROXY_TARGET, e.g. `API_PROXY_TARGET=http://localhost:8082 npm run dev`.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Same-origin requests in dev: the browser talks only to the dev server,
    // which forwards the API routes to the backend. No CORS needed.
    proxy: {
      '/scores': apiTarget,
      '/leaderboard': apiTarget,
      '/players': apiTarget,
      '/healthz': apiTarget,
      '/stats': apiTarget,
      '/swagger-ui': apiTarget,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
