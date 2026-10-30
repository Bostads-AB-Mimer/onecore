import { nationalIdPrefixes } from '@src/domain/search-term'

// Checksum-valid numbers from the national-id unit tests; nothing here reaches
// a real system.
const VALID_TWELVE = '199007292387'
const VALID_TEN = '9007292387'
const VALID_HYPHENATED = '900729-2387'

describe('nationalIdPrefixes', () => {
  describe('complete number', () => {
    it('resolves to exactly the twelve- and ten-digit forms', () => {
      expect(nationalIdPrefixes(VALID_TWELVE)).toEqual([
        '199007292387',
        '9007292387',
      ])
    })

    it('infers the century instead of guessing it', () => {
      expect(nationalIdPrefixes(VALID_TEN)).toEqual([
        '199007292387',
        '9007292387',
      ])
      expect(nationalIdPrefixes(VALID_HYPHENATED)).toEqual([
        '199007292387',
        '9007292387',
      ])
    })

    // A ten-digit number starting with 19 or 20 would otherwise get its
    // "century" stripped, producing an eight-digit prefix that hits other rows.
    it('does not strip the leading digits of a complete ten-digit number', () => {
      const candidates = nationalIdPrefixes('2001011234')
      expect(candidates).toHaveLength(2)
      expect(candidates).not.toContain('01011234')
    })
  })

  describe('partial number', () => {
    it('ignores words with fewer than six digits', () => {
      expect(nationalIdPrefixes('85051')).toEqual([])
      expect(nationalIdPrefixes('8505')).toEqual([])
    })

    it('ignores words that are not digits once separators are stripped', () => {
      expect(nationalIdPrefixes('P000111')).toEqual([])
      expect(nationalIdPrefixes('Testbert')).toEqual([])
    })

    it('ignores words longer than a twelve-digit number', () => {
      expect(nationalIdPrefixes('1985051064781')).toEqual([])
    })

    it('tries both centuries for a prefix typed without one', () => {
      expect(nationalIdPrefixes('850510')).toEqual([
        '850510',
        '19850510',
        '20850510',
      ])
    })

    it('tries the century-stripped form for a prefix typed with one', () => {
      expect(nationalIdPrefixes('19850510')).toEqual([
        '19850510',
        '850510',
        '1919850510',
        '2019850510',
      ])
    })

    it('falls back to guessing when a full-length number has a bad checksum', () => {
      expect(nationalIdPrefixes('199007292388')).toEqual([
        '199007292388',
        '9007292388',
      ])
    })

    it('strips hyphen and plus before matching', () => {
      expect(nationalIdPrefixes('850510-64')).toEqual(
        nationalIdPrefixes('85051064')
      )
      expect(nationalIdPrefixes('850510+64')).toEqual(
        nationalIdPrefixes('85051064')
      )
    })
  })
})
