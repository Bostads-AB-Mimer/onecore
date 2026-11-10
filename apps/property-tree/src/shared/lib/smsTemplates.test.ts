import { describe, expect, it } from 'vitest'

import { shouldConfirmTemplateReplace } from './smsTemplates'

describe('shouldConfirmTemplateReplace', () => {
  it('applies silently into an empty or whitespace-only box', () => {
    expect(shouldConfirmTemplateReplace('', null)).toBe(false)
    expect(shouldConfirmTemplateReplace('   \n', null)).toBe(false)
  })

  it('applies silently when the text is still the applied template', () => {
    expect(shouldConfirmTemplateReplace('Hej!', 'Hej!')).toBe(false)
  })

  it('asks when the rep has typed or edited text', () => {
    expect(shouldConfirmTemplateReplace('Hej!', null)).toBe(true)
    expect(shouldConfirmTemplateReplace('Hej! Ändrad', 'Hej!')).toBe(true)
  })
})
