import { isOldEnough } from '@src/domain/age-rule'

/** Turns 16 on New Year's Eve 2026. */
const BORN_2010_12_31 = '201012312383'
/** Turns 16 on 1 January 2027. */
const BORN_2011_01_01 = '201101012381'
/** Turns 16 on New Year's Eve 2027. */
const BORN_2011_12_31 = '201112312382'

/** Noon on 31 December 2026, Swedish time. */
const NEW_YEARS_EVE_2026 = new Date('2026-12-31T11:00:00Z')
/** 00:30 on 1 January 2027 in Sweden, still 2026 in UTC. */
const JUST_AFTER_NEW_YEAR_2027 = new Date('2026-12-31T23:30:00Z')

describe('isOldEnough', () => {
  describe('birth-year', () => {
    it('lets someone in who turns 16 on New Year’s Eve', () => {
      expect(
        isOldEnough(BORN_2010_12_31, 'birth-year', NEW_YEARS_EVE_2026)
      ).toBe(true)
    })

    it('refuses someone who turns 16 next year', () => {
      expect(
        isOldEnough(BORN_2011_01_01, 'birth-year', NEW_YEARS_EVE_2026)
      ).toBe(false)
    })

    it('opens at midnight Swedish time on 1 January, not UTC', () => {
      expect(
        isOldEnough(BORN_2011_12_31, 'birth-year', JUST_AFTER_NEW_YEAR_2027)
      ).toBe(true)
    })
  })

  describe('exact-age', () => {
    it('refuses someone who turns 16 later this year', () => {
      expect(
        isOldEnough(
          BORN_2010_12_31,
          'exact-age',
          new Date('2026-06-01T10:00:00Z')
        )
      ).toBe(false)
    })

    it('lets someone in on their sixteenth birthday', () => {
      expect(
        isOldEnough(BORN_2010_12_31, 'exact-age', NEW_YEARS_EVE_2026)
      ).toBe(true)
    })

    it('refuses an invalid national ID', () => {
      expect(isOldEnough('201012312384', 'exact-age', NEW_YEARS_EVE_2026)).toBe(
        false
      )
    })
  })
})
