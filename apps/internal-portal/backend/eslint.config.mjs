import { defineConfig } from 'eslint/config'

import onecoreBase from '../../../eslint.config.mjs'

export default defineConfig([
  onecoreBase,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    files: ['src/**/*.test.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
])
