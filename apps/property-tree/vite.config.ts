import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { injectEnv } from './script/inject-env.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Optional module packages, build time only (not overridable at runtime like
  // VITE_*): unset = all; a list without a module (or `none`) aliases that
  // package to a stub so its code never enters the bundle (src/shared/config/modules.ts).
  const rawModules = env.ONECORE_FRONTEND_MODULES?.trim()
  const enabledModules = rawModules
    ? rawModules.split(',').map((m) => m.trim())
    : ['leasing']
  const leasingSource = enabledModules.includes('leasing')
    ? mode === 'development'
      ? path.resolve(__dirname, '../leasing-portal/frontend/src/index.ts')
      : undefined
    : path.resolve(__dirname, './src/shared/config/disabledModule.ts')

  return {
    plugins: [
      react(),
      {
        name: 'transform-html',
        transformIndexHtml: (html) => injectEnv(html, env),
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
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Dev loads the leasing pages from source so they hot-reload here;
        // builds use the package's dist/lib like any other dependency.
        ...(leasingSource
          ? { '@onecore/leasing-portal-frontend': leasingSource }
          : {}),
      },
    },
  }
})
