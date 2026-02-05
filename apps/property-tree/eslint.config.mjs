import { defineConfig } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'
import typescriptEslint from 'typescript-eslint'

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
      'boundaries/elements': [
        { type: 'types', pattern: 'src/types/*' },
        { type: 'config', pattern: 'src/config/*' },
        { type: 'utils', pattern: 'src/utils/*' },
        { type: 'styles', pattern: 'src/styles/*' },
        { type: 'assets', pattern: 'src/assets/*' },
        { type: 'services', pattern: 'src/services/*' },
        { type: 'hooks', pattern: 'src/hooks/*' },
        { type: 'components', pattern: 'src/components/*' },
        { type: 'store', pattern: 'src/store/*' },
        { type: 'layouts', pattern: 'src/layouts/*' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'pages', pattern: 'src/pages/*' },
        // Legacy folders (to be migrated) - no restrictions for now
        {
          type: 'legacy',
          pattern: ['src/lib/*', 'src/contexts/*', 'src/auth/*'],
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
      'boundaries/no-unknown-files': ['warn'],

      // Enforce importing through index.ts (barrel exports) for features
      'boundaries/entry-point': [
        'warn',
        {
          default: 'allow',
          rules: [
            {
              // Only allow importing features through their index.ts
              target: ['features'],
              allow: 'index.(ts|tsx)',
            },
          ],
        },
      ],

      'boundaries/element-types': [
        //CHANGE THIS TO 'error' WHEN REFACTORING IS COMPLETE
        'warn',
        {
          default: 'disallow',
          rules: [
            // types: can import nothing (only other types)
            {
              from: 'types',
              allow: ['types'],
            },
            // config: can import types
            {
              from: 'config',
              allow: ['types', 'config'],
            },
            // utils: can import types, config
            {
              from: 'utils',
              allow: ['types', 'config', 'utils'],
            },
            // services: can import types, utils, config
            {
              from: 'services',
              allow: ['types', 'utils', 'config', 'services'],
            },
            // hooks: can import types, utils, config
            {
              from: 'hooks',
              allow: ['types', 'utils', 'config', 'hooks'],
            },
            // components: can import types, utils, styles, components
            {
              from: 'components',
              allow: ['types', 'utils', 'styles', 'components'],
            },
            // store: can import types, utils, config, services
            {
              from: 'store',
              allow: ['types', 'utils', 'config', 'services', 'store'],
            },
            // layouts: can import components, hooks, utils, types, styles, store
            {
              from: 'layouts',
              allow: [
                'types',
                'utils',
                'styles',
                'components',
                'hooks',
                'store',
                'layouts',
              ],
            },
            // features: can import components, hooks, services, utils, types, config, store
            // CANNOT import other features
            {
              from: 'features',
              allow: [
                'types',
                'utils',
                'config',
                'styles',
                'services',
                'hooks',
                'components',
                'store',
              ],
            },
            // pages: can import almost everything (top level)
            {
              from: 'pages',
              allow: [
                'types',
                'utils',
                'config',
                'styles',
                'services',
                'hooks',
                'components',
                'store',
                'layouts',
                'features',
              ],
            },
          ],
        },
      ],
    },
  },
])
