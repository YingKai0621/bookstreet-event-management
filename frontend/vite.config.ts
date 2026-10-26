import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ['react-router-dom', 'qrcode.react'] },
  server: {
    headers: { 'Referrer-Policy': 'no-referrer' },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: { 'Referrer-Policy': 'no-referrer' },
  },
})
