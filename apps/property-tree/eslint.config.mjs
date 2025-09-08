import { defineConfig } from 'eslint/config'

import onecoreReactBase from '../../eslint.react.config.mjs'

export default defineConfig([
  [
    onecoreReactBase,
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
