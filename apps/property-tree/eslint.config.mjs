import { defineConfig } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'
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
        { type: 'shared', pattern: 'src/shared/*' },
        { type: 'services', pattern: 'src/services/*' },
        { type: 'entities', pattern: 'src/entities/*' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'widgets', pattern: 'src/widgets/*' },
        { type: 'layouts', pattern: 'src/layouts/*' },
        { type: 'views', pattern: 'src/views/*' },
        // Legacy folders (to be migrated) - no restrictions for now
        {
          type: 'legacy',
          pattern: ['src/contexts/*', 'src/app/*'],
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
        'src/auth-config.ts',
      ],
    },
    rules: {
      // Catch files not matching any defined element type
      // 'boundaries/no-unknown-files': ['warn'],

      // Enforce importing through index.ts (barrel exports) for features and entities
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
          ],
        },
      ],

      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            '${file.type}/ cannot import from ${dependency.type}/. Check the layer hierarchy: shared → services → entities → features → widgets → views.',
          rules: [
            // shared: lowest level - can only import from itself
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
            // CANNOT import other features, widgets, views, layouts
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
            // CANNOT import other widgets, views, layouts
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
            // layouts: can import shared
            // CANNOT import features, views, services, entities, widgets
            {
              from: 'layouts',
              allow: ['shared'],
            },
            // views: can import almost everything (top level)
            // CANNOT import other views
            {
              from: 'views',
              allow: [
                'shared',
                'services',
                'entities',
                'features',
                'widgets',
                'layouts',
              ],
            },
            {
              from: 'views',
              disallow: ['views'],
              message: 'Views cannot import other views.',
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
                'layouts',
                'views',
                'legacy',
              ],
            },
          ],
        },
      ],
    },
  },
])
