import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    env.VITE_OWN_API_URL || `http://localhost:${env.PORT || 3001}`

  return {
    plugins: [react()],
    resolve: {
      // Was provided by @base44/vite-plugin — required for `@/…` imports
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    server: {
      // Replaces Base44 plugin proxy (was VITE_BASE44_APP_BASE_URL).
      // Own clients mostly use VITE_OWN_API_URL directly; this covers relative `/api`.
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
