import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Removed VitePWA to eliminate service worker and precaching errors
// import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Service Worker removed to fix precaching errors
    // App still installable via manifest.webmanifest
    // All features require network anyway, so offline mode not needed
    /* VitePWA({
      registerType: 'autoUpdate', // Changed from 'prompt' to auto-update service worker
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Medical Research Companion',
        short_name: 'MedCompanion',
        description: 'Autonomous medical research companion for rare disease caregivers',
        theme_color: '#2054D9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true, // Remove old caches automatically
        skipWaiting: true, // Install new service worker immediately
        clientsClaim: true, // Take control of pages immediately
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }) */
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5176,
    strictPort: false,  // Allow fallback to another port if 5176 is in use
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        // Configure proxy timeout for long-running AI requests
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Set 3-minute timeout for proxy requests
            proxyReq.setTimeout(180000);
          });
          proxy.on('error', (err) => {
            console.error('Proxy error:', err);
          });
        }
      }
    }
  }
})
