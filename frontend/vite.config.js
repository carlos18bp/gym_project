import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  build: {
    outDir: '../backend/static/frontend',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Organizar las imágenes en subcarpetas según el tipo de archivo
          if (/\.(png|jpg|jpeg|gif|svg)$/.test(assetInfo.name)) {
            return 'img/[name][extname]';
          }
          if (/\.css$/.test(assetInfo.name)) {
            return 'css/[name][extname]';
          }
          // Para otros tipos de assets (fuentes, etc.), puedes añadir más condiciones si es necesario
          return 'assets/[name][extname]';
        },
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
      },
    },
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      outDir: '../backend/static/frontend',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      strategies: 'generateSW',
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