import {
  formatNationalRegistrationNumber,
  getContacts,
  getInvoices,
  getRentalProperties,
  mapContactFlags,
  toRentalProperty,
} from '@src/services/common/adapters/xpand-db-adapter'

describe('mapContactFlags', () => {
  describe('deceased', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.deceased).toBe(false)
    })

    it('is true when db value is non-null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: '2024-01-01',
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.deceased).toBe(true)
    })
  })

  describe('emigrated', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.emigrated).toBe(false)
    })

    it('is true when db value is non-null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: '2024-01-01',
        noAdvertising: null,
      })
      expect(result.emigrated).toBe(true)
    })
  })

  describe('noAdvertising', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.noAdvertising).toBe(false)
    })

    it('is false when db value is 0', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: 0,
      })
      expect(result.noAdvertising).toBe(false)
    })

    it('is true when db value is non-zero', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: 1,
      })
      expect(result.noAdvertising).toBe(true)
    })
  })

  describe('protectedIdentity', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.protectedIdentity).toBe(false)
    })

    it('is true when db value is non-null', () => {
      const result = mapContactFlags({
        protectedIdentity: '2024-01-01',
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.protectedIdentity).toBe(true)
    })
  })
})

describe('formatNationalRegistrationNumber', () => {
  it('drops the century and adds a dash', () => {
    expect(formatNationalRegistrationNumber('199001011234')).toBe('900101-1234')
  })

  it('adds a dash to a number without century', () => {
    expect(formatNationalRegistrationNumber('9001011234')).toBe('900101-1234')
  })

  it('trims trailing blanks', () => {
    expect(formatNationalRegistrationNumber('9001011234  ')).toBe('900101-1234')
  })

  it('returns an empty string for a missing number', () => {
    expect(formatNationalRegistrationNumber(null)).toBe('')
    expect(formatNationalRegistrationNumber('   ')).toBe('')
  })
})

describe('toRentalProperty', () => {
  it('maps an Xpand rental property row to the shared shape', () => {
    expect(
      toRentalProperty(
        {
          rentalId: '306-001-01-0101',
          address: 'Gatan 1',
          postalCode: '722 22',
          city: 'Västerås',
          type: 'Lägenhet 2 rok',
          areaSize: 54.5,
        },
        'bostad'
      )
    ).toEqual(
      expect.objectContaining({
        rentalPropertyId: '306-001-01-0101',
        size: 54.5,
        type: 'Lägenhet 2 rok',
        rentalPropertyType: 'bostad',
        address: {
          street: 'Gatan 1',
          number: '',
          postalCode: '722 22',
          city: 'Västerås',
        },
      })
    )
  })

  it('uses 0 and empty strings for missing values', () => {
    const result = toRentalProperty(
      {
        rentalId: '306-001-01-0101',
        address: null,
        postalCode: null,
        city: null,
        type: 'Förråd',
        areaSize: null,
      },
      'övrigt'
    )

    expect(result.size).toBe(0)
    expect(result.address).toEqual({
      street: '',
      number: '',
      postalCode: '',
      city: '',
    })
  })
})
