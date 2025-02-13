import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  // Esto hace que tus assets se referencien con /static/frontend/ al inicio
  base: '/static/frontend/',
  build: {
    // Coloca los archivos generados físicamente en ../backend/static/frontend
    // (ojo: es una ruta relativa a donde está tu vite.config.js)
    outDir: '../backend/static/frontend',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (/\.(png|jpg|jpeg|gif|svg)$/.test(assetInfo.name)) {
            return 'img/[name][extname]';
          }
          if (/\.css$/.test(assetInfo.name)) {
            return 'css/[name][extname]';
          }
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
      // Importante: no pongas outDir aquí, deja que use el de build.outDir
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
            type: 'image/png',
          },
          {
            src: '/static/frontend/img/icons/icon-logo-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['@tinymce/tinymce-vue', 'tinymce'],
  },
})
