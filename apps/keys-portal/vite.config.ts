/// <reference types="vitest" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { componentTagger } from 'lovable-tagger'

import { injectEnv } from './script/inject-env.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      ...(mode === 'development' ? [componentTagger()] : []),
      {
        name: 'transform-html',
        transformIndexHtml: (html) => injectEnv(html, env),
      },
    ],
    server: {
      port: Number(env.PORT) || 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5090',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
