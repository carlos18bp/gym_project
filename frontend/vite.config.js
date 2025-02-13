import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'url'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const isE2ECoverage = process.env.E2E_COVERAGE === '1'

let coverageDepsPromise
async function loadCoverageDeps() {
  if (!coverageDepsPromise) {
    coverageDepsPromise = Promise.all([
      import('@babel/core'),
      import('babel-plugin-istanbul'),
    ]).then(([babelMod, istanbulMod]) => {
      return {
        babel: babelMod.default || babelMod,
        istanbul: istanbulMod.default || istanbulMod,
      }
    })
  }

  return coverageDepsPromise
}

function e2eCoverageInstrumentation() {
  return {
    name: 'e2e-coverage-instrumentation',
    enforce: 'post',
    async transform(code, id) {
      if (!isE2ECoverage) return null
      if (!id.includes('/src/')) return null
      if (id.includes('/node_modules/')) return null
      if (id.includes('type=style')) return null
      if (id.includes('type=template')) return null
      // Skip non-code assets
      if (/\.(css|png|jpe?g|gif|svg|ico|woff2?|ttf|eot)(\?|$)/.test(id)) return null

      const { babel, istanbul } = await loadCoverageDeps()
      let filename = id.split('?')[0]
      // babel-plugin-istanbul skips non-JS extensions; .vue script blocks are
      // already compiled JS at this point (enforce:'post'), so alias to .js
      if (filename.endsWith('.vue')) {
        filename = filename + '.js'
      }
      const result = await babel.transformAsync(code, {
        filename,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        plugins: [
          [
            istanbul,
            {
              cwd: process.cwd(),
              exclude: ['**/*.test.*', '**/test/**', '**/e2e/**'],
            },
          ],
        ],
      })

      if (!result) return null

      return {
        code: result.code || code,
        map: result.map || null,
      }
    },
  }
}

function e2eCoverageCollector() {
  return {
    name: 'e2e-coverage-collector',
    configureServer(server) {
      if (!isE2ECoverage) return

      server.middlewares.use('/__e2e_coverage__', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const json = JSON.parse(body || '{}')
            const outDir = path.join(process.cwd(), '.nyc_output')
            fs.mkdirSync(outDir, { recursive: true })
            const entropy = crypto.randomBytes(16).toString('hex')
            const filename = `coverage-${Date.now()}-${entropy}.json`
            fs.writeFileSync(path.join(outDir, filename), JSON.stringify(json))
            res.statusCode = 200
            res.end('OK')
          } catch (e) {
            res.statusCode = 400
            res.end('Bad Request')
          }
        })
      })
    },
    transformIndexHtml(html) {
      if (!isE2ECoverage) return html

      const snippet = `\n<script>\n(function(){\n  function sendCoverage(){\n    try {\n      var cov = window.__coverage__;\n      if (!cov) return;\n      var payload = JSON.stringify(cov);\n      if (navigator.sendBeacon) {\n        var ok = navigator.sendBeacon('/__e2e_coverage__', payload);\n        if (ok) return;\n      }\n      try { sessionStorage.setItem('__e2e_cov_backup__', payload); } catch(e) {}\n      return fetch('/__e2e_coverage__', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });\n    } catch (e) {}\n  }\n  window.__e2eCoverageReport__ = sendCoverage;\n  window.addEventListener('pagehide', sendCoverage);\n  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') sendCoverage(); });\n})();\n</script>\n`

      return html.replace('</head>', `${snippet}</head>`)
    },
  }
}

const plugins = [
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
  }),
]

if (isE2ECoverage) {
  plugins.push(e2eCoverageInstrumentation())
  plugins.push(e2eCoverageCollector())
}

export default defineConfig({
  build: {
    base: '/static/frontend',
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