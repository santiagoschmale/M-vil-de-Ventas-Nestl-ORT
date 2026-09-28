import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // En local el backend corre aparte (uvicorn en :3000); /api se le reenvía.
  server: {
    // 127.0.0.1 y no localhost: si otro programa escucha en el 3000 por IPv6 (::1), localhost cae ahí.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  build: {
    outDir: 'build'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
