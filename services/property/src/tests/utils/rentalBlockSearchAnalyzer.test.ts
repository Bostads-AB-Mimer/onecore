import {
  analyzeRentalBlockSearchTerm,
  buildSqlLikePattern,
  getPrismaOperator,
  RentalBlockSearchTarget,
} from '@src/utils/rentalBlockSearchAnalyzer'

describe('analyzeRentalBlockSearchTerm', () => {
  describe('minimum length requirement', () => {
    it('returns empty array for empty string', () => {
      expect(analyzeRentalBlockSearchTerm('')).toEqual([])
    })

    it('returns empty array for single character', () => {
      expect(analyzeRentalBlockSearchTerm('a')).toEqual([])
    })

    it('returns empty array for whitespace only', () => {
      expect(analyzeRentalBlockSearchTerm('   ')).toEqual([])
    })

    it('processes 2+ character strings', () => {
      expect(analyzeRentalBlockSearchTerm('ab').length).toBeGreaterThan(0)
    })
  })

  describe('rental ID with dashes', () => {
    it('recognizes full rental ID format', () => {
      const result = analyzeRentalBlockSearchTerm('101-001-01-0101')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        field: 'rentalId',
        pattern: '101-001-01-0101',
        startsWith: true,
      })
    })

    it('recognizes partial rental ID with dash', () => {
      const result = analyzeRentalBlockSearchTerm('101-001')
      expect(result).toHaveLength(1)
      expect(result[0].field).toBe('rentalId')
      expect(result[0].startsWith).toBe(true)
    })

    it('recognizes rental ID starting with dash pattern', () => {
      const result = analyzeRentalBlockSearchTerm('101-')
      expect(result).toHaveLength(1)
      expect(result[0].field).toBe('rentalId')
    })
  })

  describe('pure digits (partial rental ID)', () => {
    it('recognizes 3+ digit search as partial rental ID', () => {
      const result = analyzeRentalBlockSearchTerm('101')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        field: 'rentalId',
        pattern: '101',
        startsWith: false, // contains search for partial
      })
    })

    it('recognizes longer digit sequences', () => {
      const result = analyzeRentalBlockSearchTerm('12345')
      expect(result).toHaveLength(1)
      expect(result[0].field).toBe('rentalId')
      expect(result[0].startsWith).toBe(false)
    })
  })

  describe('address with numbers', () => {
    it('recognizes Swedish address format', () => {
      const result = analyzeRentalBlockSearchTerm('Kungsgatan 5')
      expect(result.some((t) => t.field === 'address')).toBe(true)
    })

    it('recognizes address with Swedish characters', () => {
      const result = analyzeRentalBlockSearchTerm('Västra vägen 12')
      expect(result.some((t) => t.field === 'address')).toBe(true)
    })

    it('also searches rentalId for mixed alphanumeric', () => {
      const result = analyzeRentalBlockSearchTerm('LGH-101')
      expect(result.some((t) => t.field === 'rentalId')).toBe(true)
    })
  })

  describe('letters only (street name or reason)', () => {
    it('searches address, blockReason, and rentalId', () => {
      const result = analyzeRentalBlockSearchTerm('Kungsgatan')
      expect(result.some((t) => t.field === 'address')).toBe(true)
      expect(result.some((t) => t.field === 'blockReason')).toBe(true)
      expect(result.some((t) => t.field === 'rentalId')).toBe(true)
    })

    it('handles Swedish characters', () => {
      const result = analyzeRentalBlockSearchTerm('Östra')
      expect(result.some((t) => t.field === 'address')).toBe(true)
    })

    it('uses startsWith for address, contains for others', () => {
      const result = analyzeRentalBlockSearchTerm('Renovering')
      const addressTarget = result.find((t) => t.field === 'address')
      const reasonTarget = result.find((t) => t.field === 'blockReason')

      expect(addressTarget?.startsWith).toBe(true)
      expect(reasonTarget?.startsWith).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('trims whitespace', () => {
      const result = analyzeRentalBlockSearchTerm('  101-001  ')
      expect(result[0].pattern).toBe('101-001')
    })

    it('handles mixed case', () => {
      const result = analyzeRentalBlockSearchTerm('KUNGSGATAN')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})

describe('buildSqlLikePattern', () => {
  it('builds startsWith pattern', () => {
    const target: RentalBlockSearchTarget = {
      field: 'rentalId',
      pattern: '101-001',
      startsWith: true,
    }
    expect(buildSqlLikePattern(target)).toBe('101-001%')
  })

  it('builds contains pattern', () => {
    const target: RentalBlockSearchTarget = {
      field: 'rentalId',
      pattern: '101',
      startsWith: false,
    }
    expect(buildSqlLikePattern(target)).toBe('%101%')
  })
})

describe('getPrismaOperator', () => {
  it('returns startsWith for startsWith targets', () => {
    const target: RentalBlockSearchTarget = {
      field: 'address',
      pattern: 'Kung',
      startsWith: true,
    }
    expect(getPrismaOperator(target)).toBe('startsWith')
  })

  it('returns contains for non-startsWith targets', () => {
    const target: RentalBlockSearchTarget = {
      field: 'blockReason',
      pattern: 'renovering',
      startsWith: false,
    }
    expect(getPrismaOperator(target)).toBe('contains')
  })
})
