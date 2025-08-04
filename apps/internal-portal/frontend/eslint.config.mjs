import { defineConfig } from 'eslint/config';
import typescriptEslint from 'typescript-eslint';
import iteamReact from '@iteam/eslint-config-react/typescript.js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default defineConfig([
  {
    files: ['**/*.{js,ts,jsx,tsx,mjs,cjs}'],
    languageOptions: {
      sourceType: 'module',
      parser: typescriptEslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      ...iteamReact.rules,
      ...importPlugin.configs.recommended.rules,
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          groups: [
            ['external', 'builtin'],
            'internal',
            ['index', 'sibling', 'parent'],
          ],
        },
      ],
      'no-useless-catch': 'warn',
      'no-unused-vars': 'warn',
    },
  },
]);
