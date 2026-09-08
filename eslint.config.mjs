import { readFileSync } from 'fs'
import { defineConfig } from 'eslint/config'
import typescriptEslint from 'typescript-eslint'
import nPlugin from 'eslint-plugin-n'
import js from '@eslint/js'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'
import prettier from 'eslint-config-prettier'

const { engines } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig([
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptEslint.parser,
      parserOptions: {
        projectService: true,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
      import: importPlugin,
      n: nPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      node: {
        tryExtensions: ['.js', '.ts'],
        version: engines.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...prettier.rules,
      ...importPlugin.configs.typescript.rules,
      ...nPlugin.configs.recommended.rules,
      'n/no-unsupported-features/es-syntax': [
        'error',
        {
          ignores: ['modules'],
        },
      ],
      'no-useless-catch': 'warn',
      'n/hashbang': 'off',
      'n/no-missing-import': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'n/no-unpublished-import': [
        'error',
        {
          allowModules: ['onecore-types'],
        },
      ],
    },
  },
  {
    files: [
      '**/*.{test,spec}.{ts,tsx,js,jsx}',
      '**/__tests__/**',
      'test/**',
      'tests/**',
      'src/test/**',
      'src/tests/**',
    ],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
])
