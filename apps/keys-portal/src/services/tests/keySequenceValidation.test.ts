import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/api/keyService', () => ({
  keyService: {},
}))

import { parseSequenceNumberInput } from '@/utils/keySequenceValidation'

describe('parseSequenceNumberInput', () => {
  it('parses empty input, single numbers, and valid ranges', () => {
    expect(parseSequenceNumberInput('')).toEqual({ isValid: true, numbers: [] })
    expect(parseSequenceNumberInput('5')).toEqual({
      isValid: true,
      numbers: [5],
    })
    expect(parseSequenceNumberInput('1-3')).toEqual({
      isValid: true,
      numbers: [1, 2, 3],
    })
    expect(parseSequenceNumberInput('1-20').numbers).toHaveLength(20)
  })

  it('rejects invalid inputs: range > 20, reversed, equal, start < 1, non-numeric', () => {
    expect(parseSequenceNumberInput('1-21').isValid).toBe(false)
    expect(parseSequenceNumberInput('10-5').isValid).toBe(false)
    expect(parseSequenceNumberInput('3-3').isValid).toBe(false)
    expect(parseSequenceNumberInput('0-5').isValid).toBe(false)
    expect(parseSequenceNumberInput('abc').isValid).toBe(false)
    expect(parseSequenceNumberInput('1-2-3').isValid).toBe(false)
  })
})
