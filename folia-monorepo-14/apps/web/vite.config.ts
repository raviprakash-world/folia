import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Phase 10/14 (backend integration), domain by domain — see
    // apps/api's CHANGELOG.md and this repo's INTEGRATION.md for the
    // full story. Each domain proxied here is deliberately scoped to
    // its own path prefix(es): MSW mocks every other /api/* path (see
    // src/mocks/browser.ts's onUnhandledRequest: 'bypass'), and
    // proxying all of /api/* would silently break every domain that
    // hasn't been integrated yet. Real backend routes are versioned
    // (/api/v1/...); the mock handlers and the rest of this frontend
    // are not — each rewrite bridges that gap for exactly the prefixes
    // being integrated, without changing anything else. Each block is
    // OFF unless its own flag is set (see src/mocks/browser.ts).
    proxy: {
      ...(env.VITE_REAL_AUTH_API === 'true'
        ? {
            '/api/auth': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/auth/, '/api/v1/auth'),
            },
          }
        : {}),
      ...(env.VITE_REAL_CATALOG_API === 'true'
        ? {
            '/api/products': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/products/, '/api/v1/products'),
            },
            '/api/categories': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/categories/, '/api/v1/categories'),
            },
            '/api/collections': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/collections/, '/api/v1/collections'),
            },
          }
        : {}),
      ...(env.VITE_REAL_REVIEWS_API === 'true'
        ? {
            '/api/reviews': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/reviews/, '/api/v1/reviews'),
            },
          }
        : {}),
      ...(env.VITE_REAL_CART_API === 'true'
        ? {
            '/api/cart': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/cart/, '/api/v1/cart'),
            },
          }
        : {}),
      ...(env.VITE_REAL_WISHLIST_API === 'true'
        ? {
            '/api/wishlist': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/wishlist/, '/api/v1/wishlist'),
            },
          }
        : {}),
      ...(env.VITE_REAL_ADDRESSES_API === 'true'
        ? {
            '/api/addresses': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/addresses/, '/api/v1/addresses'),
            },
          }
        : {}),
      ...(env.VITE_REAL_SEARCH_API === 'true'
        ? {
            '/api/search': {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (requestPath: string) => requestPath.replace(/^\/api\/search/, '/api/v1/search'),
            },
          }
        : {}),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // These libraries are pulled in eagerly (Navbar/Layout aren't
        // lazy-loaded), so route-level code splitting alone can't keep them
        // out of the main bundle. Splitting them into their own chunks means
        // they're fetched in parallel rather than blocking on one monolithic
        // bundle, and they're cacheable independently of app code that
        // changes far more often.
        manualChunks(id) {
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/axios')) return 'vendor-http';
          if (id.includes('node_modules/zustand')) return 'vendor-state';
        },
      },
    },
  },
  };
})
