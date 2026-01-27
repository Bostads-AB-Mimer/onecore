/// <reference types="vitest" />
/// <reference types="vite/client" />
import * as path from 'node:path'
import { defineConfig, UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslintPlugin from '@nabla/vite-plugin-eslint'

const isTest = !!process.env.VITEST // Vitest sets this

export default defineConfig({
  plugins: [react(), ...(isTest ? [] : [eslintPlugin()])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@libs': path.resolve(__dirname, '../../../libs'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup/setupTests.ts'],
  },
  server: {
    port: 7003,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PROXY_TARGET_PORT || 7001}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
} as UserConfig)
