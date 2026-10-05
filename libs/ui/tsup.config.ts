import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/tailwind-preset.ts'],
  format: ['esm', 'cjs'],
  tsconfig: './tsconfig.build.json',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Copied as-is: dist/styles.css and dist/assets/* (logos), both exported as subpaths.
  publicDir: 'src/public',
})
