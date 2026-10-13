import { defineConfig } from 'eslint/config'
import typescriptEslint from 'typescript-eslint'

import onecoreReactBase from '../../eslint.react.config.mjs'

export default defineConfig([
  onecoreReactBase,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
    },
  },
])
