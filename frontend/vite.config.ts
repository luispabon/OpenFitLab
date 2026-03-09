import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  build: {
    chunkSizeWarningLimit: 1100, // maplibre-gl vendor chunk is ~1 MB; app chunks are under 500 kB
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/svelte-maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/uplot')) return 'uplot'
        },
      },
    },
  },
  resolve: {
    alias: {
      $docs: path.resolve(__dirname, './docs'),
    },
  },
  server: {
    port: 4200,
    host: true, // listen on 0.0.0.0 for Docker
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
