import { defineConfig } from 'tsup'

export default defineConfig([
  // CommonJS build - required because the platform is stuck in CommonJS
  {
    entry: ['src/index.ts', 'src/domain/index.ts', 'src/schema.ts'],
    format: ['cjs'],
    platform: 'node',
    tsconfig: './tsconfig.build.json',
    sourcemap: true,
    clean: true,
    dts: false,
    bundle: false,
    splitting: false,
    outDir: 'build/cjs',
  },

  // ESM build - because it's 2026
  {
    entry: ['src/index.ts', 'src/domain/index.ts', 'src/schema.ts'],
    format: ['esm'],
    platform: 'node',
    tsconfig: './tsconfig.build.json',
    sourcemap: true,
    clean: false,
    bundle: false,
    splitting: false,
    dts: {
      entry: ['src/index.ts', 'src/domain/index.ts', 'src/schema.ts'],
      compilerOptions: {
        rootDir: 'src',
        module: 'preserve',
        moduleResolution: 'bundler',
      },
    },
    outDir: 'build/esm',
  },
])
