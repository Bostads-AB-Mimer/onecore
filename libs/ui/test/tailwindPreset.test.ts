import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import { onecorePreset } from '../src/tailwind-preset'

describe('onecorePreset', () => {
  it('emits the shared color tokens through tailwind', async () => {
    const result = await postcss([
      tailwindcss({
        presets: [onecorePreset],
        content: [{ raw: '<div class="bg-primary rounded-lg"></div>' }],
      }),
    ]).process('@tailwind utilities;', { from: undefined })

    expect(result.css).toContain('hsl(var(--primary))')
    expect(result.css).toContain('var(--radius)')
  })
})
