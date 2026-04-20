import { transformRow } from '../../../adapters/xpand/lease-search-adapter'

const baseRow = {
  leaseId: '705-001-01-0101/1',
  objectTypeCode: 'balgh',
  leaseType: 'Bostadskontrakt',
  address: 'Stentorpsgatan 9 A',
  postalCode: '72216',
  city: 'Västerås',
  startDate: '2020-01-01',
  lastDebitDate: '2025-12-31',
}

describe('transformRow — postalCode and city', () => {
  it('maps postalCode from db row', () => {
    const result = transformRow({ ...baseRow, postalCode: '72216' })
    expect(result.postalCode).toBe('72216')
  })

  it('maps city from db row', () => {
    const result = transformRow({ ...baseRow, city: 'Västerås' })
    expect(result.city).toBe('Västerås')
  })

  it('postalCode is null when db value is null', () => {
    const result = transformRow({ ...baseRow, postalCode: null })
    expect(result.postalCode).toBeNull()
  })

  it('postalCode is null when db value is empty string', () => {
    const result = transformRow({ ...baseRow, postalCode: '' })
    expect(result.postalCode).toBeNull()
  })

  it('city is null when db value is null', () => {
    const result = transformRow({ ...baseRow, city: null })
    expect(result.city).toBeNull()
  })

  it('city is null when db value is empty string', () => {
    const result = transformRow({ ...baseRow, city: '' })
    expect(result.city).toBeNull()
  })

  it('trims trailing whitespace from postalCode', () => {
    const result = transformRow({ ...baseRow, postalCode: '72216  ' })
    expect(result.postalCode).toBe('72216')
  })

  it('trims trailing whitespace from city', () => {
    const result = transformRow({ ...baseRow, city: 'Västerås  ' })
    expect(result.city).toBe('Västerås')
  })
})
