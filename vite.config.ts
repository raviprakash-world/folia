import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
})
