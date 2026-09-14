import { decodeTenfastQueryString } from '../../../adapters/tenfast/tenfast-helpers'

describe('decodeTenfastQueryString', () => {
  it('decodes percent-encoded square brackets in keys', () => {
    const qs = new URLSearchParams({ 'filter[stage]': 'active' })
    expect(decodeTenfastQueryString(qs)).toBe('filter[stage]=active')
  })

  it('decodes percent-encoded commas in values', () => {
    const qs = new URLSearchParams({ 'filter[stage]': 'active,upcoming' })
    expect(decodeTenfastQueryString(qs)).toBe('filter[stage]=active,upcoming')
  })

  it('decodes both brackets and commas in the same string', () => {
    const qs = new URLSearchParams({
      'filter[stage]': 'active,upcoming',
      'filter[isArchived]': 'false',
    })
    const result = decodeTenfastQueryString(qs)
    expect(result).toContain('filter[stage]=active,upcoming')
    expect(result).toContain('filter[isArchived]=false')
  })

  it('is case-insensitive for percent-encoding (%5b and %5B both work)', () => {
    // Simulate manually constructed string with lowercase encoding
    const raw = 'filter%5bstage%5d=active%2cupcoming'
    const fakeQs = { toString: () => raw } as URLSearchParams
    expect(decodeTenfastQueryString(fakeQs)).toBe('filter[stage]=active,upcoming')
  })

  it('returns an empty string for empty URLSearchParams', () => {
    expect(decodeTenfastQueryString(new URLSearchParams())).toBe('')
  })
})
