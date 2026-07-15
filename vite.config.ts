import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Libraries (e.g. Recharts) may read process.env.NODE_ENV at runtime
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  build: {
    assetsDir: 'assets',
  },
}))
