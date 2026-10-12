import { describe, expect, it } from 'vitest'

import { serverMessage } from './serverMessage'

describe('serverMessage', () => {
  it("reads core's error text", () => {
    expect(
      serverMessage({ error: 'Kan inte ta bort: modellen har 3 komponenter' })
    ).toBe('Kan inte ta bort: modellen har 3 komponenter')
  })

  it('ignores anything else', () => {
    expect(serverMessage(new Error('boom'))).toBeUndefined()
    expect(serverMessage({ error: [{ path: 'x' }] })).toBeUndefined()
    expect(serverMessage(null)).toBeUndefined()
  })
})
