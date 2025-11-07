import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const manualChunks = (id) => {
  if (id.includes('/src/pages/')) {
    const normalized = id
      .split('/src/pages/')[1]
      .replace(/\.[^/.]+$/, '')
      .replace(/[\\/]/g, '-')
      .toLowerCase()
    return `page-${normalized}`
  }

  if (!id.includes('node_modules')) {
    return null
  }

  if (id.includes('firebase') || id.includes('react-firebase-hooks')) {
    return 'firebase'
  }

  if (
    id.includes('@mui') ||
    id.includes('@emotion') ||
    id.includes('tss-react')
  ) {
    return 'mui'
  }

  if (id.includes('react-router') || id.includes('history')) {
    return 'router'
  }

  if (id.includes('react-dom') || id.includes('scheduler')) {
    return 'react-dom'
  }

  if (id.includes('/node_modules/react/')) {
    return 'react'
  }

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/sounds': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
        chunkFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})
