import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'url';

// https://vitejs.dev/config/
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
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});

