import { defineConfig } from 'eslint/config'

import onecoreBase from '../eslint.config.mjs'

export default defineConfig([
  onecoreBase,
  {
    files: ['src/**/*.test.ts', 'test/**/*.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
])
