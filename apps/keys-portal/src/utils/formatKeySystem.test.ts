import { describe, it, expect } from 'vitest'
import {
  formatKeySystemLabel,
  formatKeySystemTooltip,
} from '@/utils/formatKeySystem'

describe('formatKeySystemLabel', () => {
  it('returns the name', () => {
    expect(
      formatKeySystemLabel({ name: 'Kvarteret Svalan', systemCode: 'KS-123' })
    ).toBe('Kvarteret Svalan')
  })

  it('falls back to the code when the name is blank', () => {
    expect(formatKeySystemLabel({ name: '  ', systemCode: 'KS-123 ' })).toBe(
      'KS-123'
    )
  })
})

describe('formatKeySystemTooltip', () => {
  it('returns name and code', () => {
    expect(
      formatKeySystemTooltip({ name: 'Kvarteret Svalan', systemCode: 'KS-123' })
    ).toBe('Kvarteret Svalan (KS-123)')
  })

  it('returns only the code when the name is blank', () => {
    expect(formatKeySystemTooltip({ name: '', systemCode: 'KS-123' })).toBe(
      'KS-123'
    )
  })
})
