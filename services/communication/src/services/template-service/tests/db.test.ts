import { isUniqueNameViolation, toTemplate } from '../adapters/db'

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}))

describe('isUniqueNameViolation', () => {
  it('recognises MSSQL duplicate-key errors by number', () => {
    expect(isUniqueNameViolation({ number: 2601 })).toBe(true)
    expect(isUniqueNameViolation({ number: 2627 })).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isUniqueNameViolation({ number: 547 })).toBe(false)
    expect(isUniqueNameViolation(new Error('boom'))).toBe(false)
    expect(isUniqueNameViolation(null)).toBe(false)
    expect(isUniqueNameViolation('2601')).toBe(false)
  })
})

describe('toTemplate', () => {
  const row = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Nyckel klar',
    channels: 'sms',
    subject: null,
    body: 'Hej!',
    categories: null,
    isActive: true,
    createdAt: new Date('2026-11-06T00:00:00.000Z'),
    updatedAt: new Date('2026-11-06T00:00:00.000Z'),
  }

  it('splits the comma-separated columns into arrays', () => {
    expect(
      toTemplate({ ...row, channels: 'sms,email', categories: 'a,b' })
    ).toMatchObject({ channels: ['sms', 'email'], categories: ['a', 'b'] })
  })

  it('maps null/empty categories to an empty array', () => {
    expect(toTemplate(row).categories).toEqual([])
    expect(toTemplate({ ...row, categories: '' }).categories).toEqual([])
  })
})
