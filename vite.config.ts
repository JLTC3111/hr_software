import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Libraries (e.g. Recharts) may read process.env.NODE_ENV at runtime
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  build: {
    assetsDir: 'assets',
  },
}))
