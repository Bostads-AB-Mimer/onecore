import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

import { createCoreAuthMiddleware } from './core-auth-middleware'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const coreAuth = createCoreAuthMiddleware({
    url: env.VITE_CORE_API_URL,
    username: env.CORE_USERNAME,
    password: env.CORE_PASSWORD,
  })

  return {
    plugins: [
      react(),
      {
        name: 'core-auth-dev',
        configureServer: (server) => {
          server.middlewares.use(coreAuth)
        },
      },
    ],
    server: {
      port: Number(env.PORT) || 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5050',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/core/api': {
          target: env.VITE_CORE_API_URL || 'http://localhost:5010',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/core\/api/, ''),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
