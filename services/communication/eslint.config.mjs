import { defineConfig } from 'eslint/config';

import onecoreBase from '../../eslint.config.mjs'

export default defineConfig([
  onecoreBase,
  {
    files: ['**/*.{js,ts,mjs,cjs}'],
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
]);
