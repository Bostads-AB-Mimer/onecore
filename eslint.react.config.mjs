import { defineConfig } from 'eslint/config'

import globals from 'globals'
import iteamReact from '@iteam/eslint-config-react/typescript.js'
import nPlugin from 'eslint-plugin-n'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import onecoreBase from './eslint.config.mjs'

export default defineConfig([
  onecoreBase,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        React: true,
        NodeJS: true,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...iteamReact.rules,
      ...Object.fromEntries(
        Object.keys(nPlugin.rules).map((r) => [`n/${r}`, 'off'])
      ),
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  [
    {
      files: [
        'src/services/api/generated/api-types.ts',
        'src/services/api/core/generated/api-types.ts',
      ],
      rules: {
        '@typescript-eslint/no-empty-object-type': 'off',
      },
    },
  ],
])
