import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://54.175.133.69:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  build: {
    rollupOptions: {
      // Caps how many files Rollup reads/writes concurrently during the
      // "rendering chunks" phase — that phase is what OOM-killed the build
      // on a memory-constrained instance (t2/t3.micro-class, ~1GB RAM).
      // Lower parallelism trades a bit of build time for a smaller peak
      // memory footprint. Doesn't change the shipped output at all.
      maxParallelFileOps: 2,
    },
  },
})
