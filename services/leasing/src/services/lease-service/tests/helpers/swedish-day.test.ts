import { toSwedishDay } from '../../helpers/swedish-day'

describe('toSwedishDay', () => {
  it('returns the date as YYYY-MM-DD', () => {
    expect(toSwedishDay(new Date('2026-11-19T12:00:00Z'))).toBe('2026-11-19')
  })

  it('uses Swedish midnight, not UTC midnight', () => {
    // 23:30 UTC is 00:30 the next day in Sweden (CET, UTC+1)
    expect(toSwedishDay(new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19')
  })

  it('handles summer time', () => {
    // 22:30 UTC is 00:30 the next day in Sweden (CEST, UTC+2)
    expect(toSwedishDay(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
  })
})
