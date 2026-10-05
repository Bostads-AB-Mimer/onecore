import { defineConfig } from 'tsup'

// Library build: the pages entry property-tree imports. The shell is built by vite.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  tsconfig: './tsconfig.build.json',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist/lib',
})
