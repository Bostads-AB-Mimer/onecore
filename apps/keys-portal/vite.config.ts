import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { injectEnv } from './script/inject-env.js'
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
plugins: [
  react(),                    // Plugin 1: React support
  ...(mode === "development" ? [componentTagger()] : []), // Plugin 2: ComponentTagger (conditional)
  {                          // Plugin 3: Custom HTML transform
    name: 'transform-html',
    transformIndexHtml: (html) => injectEnv(html, env),
  },
],
    server: {
      port: Number(env.PORT) || 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5080',
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
  }
})


//export default defineConfig(({ mode }) => ({
//   server: {
//     host: "::",
//     port: 8080,
//   },
//   plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));
// https://vitejs.dev/config/

