import { defineConfig } from 'eslint/config';
import typescriptEslint from 'typescript-eslint';
import nPlugin from 'eslint-plugin-n';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default defineConfig([
  {
    files: ['**/*.{js,ts,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: typescriptEslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
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
      node: {
        tryExtensions: ['.js', '.ts'],
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
      'no-unused-vars': 'warn',
      'n/no-missing-import': 'off'
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
]);
