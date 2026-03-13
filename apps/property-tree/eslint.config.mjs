import { defineConfig } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import typescriptEslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'

import onecoreReactBase from '../../eslint.react.config.mjs'

export default defineConfig([
  onecoreReactBase,
  {
    files: [
      'src/services/api/generated/api-types.ts',
      'src/services/api/core/generated/api-types.ts',
    ],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  // Import sorting: FSD layer hierarchy (bottom → top)
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            // Side effect imports (e.g., import './index.css')
            ['^\\u0000'],
            // React, then external packages
            ['^react', '^@?\\w'],
            // FSD layers: app → pages → widgets → features → entities → services → shared
            ['^@/app'],
            ['^@/pages'],
            ['^@/widgets'],
            ['^@/features'],
            ['^@/entities'],
            ['^@/services'],
            ['^@/shared'],
            // Any other @/ imports (e.g., @/contexts)
            ['^@/'],
            // Relative imports
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'warn',
      // Cross-layer imports must use @/ alias so boundaries + sorting work
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../**/shared/*', '../shared/*'],
              message: 'Use @/shared/ instead of relative paths.',
            },
            {
              group: ['../**/services/*', '../services/*'],
              message: 'Use @/services/ instead of relative paths.',
            },
            {
              group: ['../**/entities/*', '../entities/*'],
              message: 'Use @/entities/ instead of relative paths.',
            },
            {
              group: ['../**/features/*', '../features/*'],
              message: 'Use @/features/ instead of relative paths.',
            },
            {
              group: ['../**/widgets/*', '../widgets/*'],
              message: 'Use @/widgets/ instead of relative paths.',
            },
            {
              group: ['../**/pages/*', '../pages/*'],
              message: 'Use @/pages/ instead of relative paths.',
            },
            {
              group: ['../**/app/*', '../app/*'],
              message: 'Use @/app/ instead of relative paths.',
            },
          ],
        },
      ],
    },
  },
  // File naming: PascalCase or camelCase for .tsx files (components = PascalCase, hooks = camelCase)
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/main.tsx'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          cases: {
            pascalCase: true,
            camelCase: true,
          },
        },
      ],
    },
  },
  // File naming: camelCase for all other source files (.ts, .js, .jsx)
  {
    files: ['src/**/*.{ts,js,jsx}'],
    ignores: ['src/**/generated/**', 'src/vite-env.d.ts'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': ['error', { case: 'camelCase' }],
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      // @ts-expect-error - boundaries plugin types don't match ESLint's Plugin type
      boundaries,
      '@typescript-eslint': typescriptEslint.plugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
      'boundaries/elements': [
        // FSD layers (bottom → top): shared → services → entities → features → widgets → pages → app
        //
        // Layers with entry-point rules (features, entities, widgets) use 'src/layer/*'
        // so each sub-folder is an individual element (e.g. src/features/buildings).
        //
        // Other layers use 'src/layer' — the entire folder is one element,
        // covering both direct files and sub-folders.
        { type: 'shared', pattern: 'src/shared' },
        { type: 'services', pattern: 'src/services' },
        { type: 'entities', pattern: 'src/entities/*' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'widgets', pattern: 'src/widgets/*' },
        { type: 'pages', pattern: 'src/pages' },
        { type: 'app', pattern: 'src/app' },
        // Legacy (to be migrated)
        {
          type: 'legacy',
          pattern: ['src/contexts/*'],
        },
      ],
      'boundaries/ignore': [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        // Root-level files (outside folder structure)
        'src/App.tsx',
        'src/main.tsx',
        'src/index.css',
        'src/vite-env.d.ts',
        'src/authConfig.ts',
      ],
    },
    rules: {
      // Catch files not matching any defined element type
      // 'boundaries/no-unknown-files': ['warn'],

      // Enforce importing through index.ts (barrel exports) for features, entities, and widgets
      // shared/ui is excluded — direct imports like @/shared/ui/Button are allowed
      'boundaries/entry-point': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              target: ['features'],
              allow: 'index.(ts|tsx)',
            },
            {
              target: ['entities'],
              allow: 'index.(ts|tsx)',
            },
            {
              target: ['widgets'],
              allow: 'index.(ts|tsx)',
            },
          ],
        },
      ],

      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            '${file.type}/ cannot import from ${dependency.type}/. Check the FSD layer hierarchy: shared → services → entities → features → widgets → pages → app.',
          rules: [
            // shared: lowest level — can only import from itself
            {
              from: 'shared',
              allow: ['shared'],
            },
            // services: can import shared
            {
              from: 'services',
              allow: ['shared', 'services'],
            },
            // entities: can import shared, services, other entities
            {
              from: 'entities',
              allow: ['shared', 'services', 'entities'],
            },
            // features: can import entities, shared, services
            // CANNOT import other features
            {
              from: 'features',
              allow: ['shared', 'services', 'entities'],
            },
            {
              from: 'features',
              disallow: ['features'],
              message:
                'Features cannot import other features. Extract shared code into entities/ or shared/.',
            },
            // widgets: can import features, entities, shared, services
            // CANNOT import other widgets
            {
              from: 'widgets',
              allow: ['shared', 'services', 'entities', 'features'],
            },
            {
              from: 'widgets',
              disallow: ['widgets'],
              message:
                'Widgets cannot import other widgets. Extract shared code into features/ or shared/.',
            },
            // pages: top composition layer — can import everything below
            // CANNOT import other pages
            {
              from: 'pages',
              allow: ['shared', 'services', 'entities', 'features', 'widgets'],
            },
            {
              from: 'pages',
              disallow: ['pages'],
              message: 'Pages cannot import other pages.',
            },
            // app: application layer — can import everything
            {
              from: 'app',
              allow: [
                'shared',
                'services',
                'entities',
                'features',
                'widgets',
                'pages',
                'app',
              ],
            },
            // legacy: no restrictions during migration
            {
              from: 'legacy',
              allow: [
                'shared',
                'services',
                'entities',
                'features',
                'widgets',
                'pages',
                'app',
                'legacy',
              ],
            },
          ],
        },
      ],
    },
  },
])
