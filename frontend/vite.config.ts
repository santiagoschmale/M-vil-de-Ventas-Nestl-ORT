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
    outDir: 'build',
    rollupOptions: {
      // MUI y el resto de las librerías aparte: cambian poco, el navegador las guarda entre versiones
      // y ningún archivo pasa los 500 kB.
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/@mui/x-')) return 'mui-x';
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) return 'mui';
          // MSAL se carga solo con Entra (import dinámico): no va al paquete inicial.
          if (id.includes('node_modules/') && !id.includes('node_modules/@azure/')) return 'vendor';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
