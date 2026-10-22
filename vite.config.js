import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Parrot',
        short_name: 'Parrot',
        description: 'A private, offline audio & video journal. Nothing leaves your device.',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Anything that is not the app shell: cache on first use, then serve offline forever.
        runtimeCaching: [
          {
            // ONNX Runtime wasm binaries (fetched from jsDelivr by @xenova/transformers).
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*\.(wasm|mjs)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onnx-runtime',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  // @xenova/transformers ships its own ONNX runtime; esbuild pre-bundling breaks it.
  optimizeDeps: { exclude: ['@xenova/transformers'] },
  build: { target: 'esnext' },
  worker: { format: 'es' },
})
