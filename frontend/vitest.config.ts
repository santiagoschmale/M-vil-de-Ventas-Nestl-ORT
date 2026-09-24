import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.ts'],
        // Cada worker carga jsdom y MUI enteros: con uno por núcleo el pico pasaba 2 GB.
        maxWorkers: 2,
        minWorkers: 1,
        coverage: {
          provider: 'v8',
          // `npm test` la pide con --coverage (y CI); una corrida suelta no la necesita.
          enabled: false,
          reporter: [
            'text',
            'html',
            'lcov'
          ],
          reportsDirectory: './coverage',
          include: ['src/**/*.{ts,tsx}'],
          exclude: [
            'node_modules/',
            'dist/',
            'src/main.tsx',
            'src/theme.tsx',
            'src/**/*.d.ts',
            'src/**/index.ts',
            'src/**/*.types.ts',
          ],
        },
    },
    plugins: [react()]
})