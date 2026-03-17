import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('@mui/icons-material')) return 'vendor-mui-icons';
          if (id.includes('@mui/x-date-pickers')) return 'vendor-mui-pickers';
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('plantuml-encoder')) return 'vendor-plantuml';
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('micromark') || id.includes('mdast') || id.includes('unified') || id.includes('vfile') || id.includes('hast')) return 'vendor-markdown';
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) return 'vendor-react';
          return 'vendor-misc';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Task Time Tracker',
        short_name: 'TaskTracker',
        description: '任務與時間管理工具',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
