import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/akadem-raznica/',
  server: {
    proxy: {
      '/vstu-api': {
        target: 'https://schedule.vstu.by',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vstu-api/, '/api/v1'),
      },
    },
  },
})
