/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { injectEnv } from './script/inject-env.js'

// Builds the standalone shell. The pages library is built by tsup (tsup.config.ts).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'transform-html',
        transformIndexHtml: (html) => injectEnv(html, env),
      },
    ],
    server: {
      port: Number(env.PORT) || 3020,
    },
    build: {
      outDir: 'dist/app',
      emptyOutDir: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['test/**/*.test.{ts,tsx}'],
    },
  }
})
