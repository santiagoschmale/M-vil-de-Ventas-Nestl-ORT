import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.ts'],
        coverage: {
          provider: 'v8',
          enabled: true,
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