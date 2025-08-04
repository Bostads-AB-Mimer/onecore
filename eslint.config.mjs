import { defineConfig } from 'eslint/config';
import js from '@eslint/js';

export default defineConfig([
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {},
  },
]);
