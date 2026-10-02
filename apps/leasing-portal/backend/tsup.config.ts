import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  tsconfig: './tsconfig.build.json',
  sourcemap: true,
  clean: true,
  bundle: true,
  splitting: false,
  dts: false,
  outDir: 'build',
})
