import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  base: '/static/',
  build: {
    outDir: 'static',
    rollupOptions: {
      output: {
        assetFileNames: 'frontend/[name][extname]',
        entryFileNames: 'frontend/[name].js',
        chunkFileNames: 'frontend/[name].js',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: '', 
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
          },
        ],
      },
      manifest: {
        name: 'G&M',
        short_name: 'G&M',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/static/frontend/img/icons/icon-logo-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/static/frontend/img/icons/icon-logo-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    include: ['@tinymce/tinymce-vue', 'tinymce'],
  },
})
