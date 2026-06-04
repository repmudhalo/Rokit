import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, the React app runs on Vite (5173) and the chat hub runs on the
// Node server (8080). Proxy the WebSocket so the frontend can use a relative
// "/ws" URL in both dev and production (where the server serves the build).
const SERVER_PORT = process.env.SERVER_PORT || 8080

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API → Node server (forwards Set-Cookie so sessions work in dev).
      '/api': { target: `http://localhost:${SERVER_PORT}`, changeOrigin: true },
      // Chat hub WebSocket → Node server.
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  build: {
    // Emit into the server so `npm start` can serve the built app.
    outDir: '../server/public',
    emptyOutDir: true,
  },
})
