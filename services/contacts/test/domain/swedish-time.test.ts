import { swedishDate, swedishYear } from '@src/domain/swedish-time'

describe('swedishDate', () => {
  it('gives the Swedish date after midnight in Sweden, before it in UTC', () => {
    // 00:30 CET on 5 November is 23:30 UTC on 4 November.
    expect(swedishDate(new Date('2026-11-04T23:30:00Z'))).toBe('2026-11-05')
  })

  it('follows summer time', () => {
    // 00:30 CEST on 29 July is 22:30 UTC on 28 July.
    expect(swedishDate(new Date('2026-07-28T22:30:00Z'))).toBe('2026-07-29')
    expect(swedishDate(new Date('2026-07-28T21:30:00Z'))).toBe('2026-07-28')
  })
})

describe('swedishYear', () => {
  it("turns on New Year's Day in Sweden, while UTC is still on New Year's Eve", () => {
    expect(swedishYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027)
  })
})
