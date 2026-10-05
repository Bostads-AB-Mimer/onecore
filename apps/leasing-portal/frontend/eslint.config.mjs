import { defineConfig } from 'eslint/config'
import typescriptEslint from 'typescript-eslint'

import onecoreReactBase from '../../../eslint.react.config.mjs'

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
  {
    files: ['src/api/generated/api-types.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['test/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Pages are mounted by hosts and must stay independent of the standalone shell.
  {
    files: ['src/pages/**', 'src/host/**', 'src/api/**', 'src/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/shell/**'],
              message:
                'Pages, host and api must not import from the shell. The host app provides config and layout.',
            },
          ],
        },
      ],
    },
  },
])
