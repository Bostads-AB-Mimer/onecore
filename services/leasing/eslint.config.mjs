/* eslint-disable n/no-unpublished-import */
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import nodePlugin from 'eslint-plugin-n'

export default [
  { plugins: { n: nodePlugin } },
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'n/no-unsupported-features/es-syntax': [
        'error',
        {
          ignores: ['modules'],
        },
      ],
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
    files: ['**/*.test.ts'],
    rules: {
      'n/no-unpublished-import': 0,
    },
  },
]
