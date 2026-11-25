import type { Contact } from '@onecore/contacts/schema'

import { toLeaseTerminationTenant } from '../send-notification'

const base = {
  contactCode: 'P123456',
  contactKey: '_P123456',
  protectedIdentity: false,
  communication: {
    phoneNumbers: [],
    emailAddresses: [],
    specialAttention: false,
  },
  addresses: [
    {
      street: 'Storgatan 1',
      zipCode: '722 11',
      city: 'Västerås',
      region: null,
      country: null,
      full: null,
    },
  ],
}

const person = (birthDate: string | null): Contact => ({
  ...base,
  type: 'individual',
  personal: {
    nationalId: '198503142382',
    birthDate,
    firstName: 'Anna',
    lastName: 'Andersson',
    fullName: 'Anna Andersson',
  },
})

describe('toLeaseTerminationTenant', () => {
  it('keeps only the date part of the birth date, never the national id', () => {
    const tenant = toLeaseTerminationTenant(person('1985-03-14T00:00:00.000Z'))

    expect(tenant).toEqual({
      contactCode: 'P123456',
      fullName: 'Anna Andersson',
      birthDate: '1985-03-14',
      street: 'Storgatan 1',
      zipCode: '722 11',
      city: 'Västerås',
    })
    expect(JSON.stringify(tenant)).not.toContain('2382')
  })

  it.each([null, 'redacted'])('leaves birthDate empty for %p', (birthDate) => {
    expect(toLeaseTerminationTenant(person(birthDate)).birthDate).toBe('')
  })

  it('uses the organisation name and no birth date for a company', () => {
    const tenant = toLeaseTerminationTenant({
      ...base,
      contactCode: 'F000123',
      type: 'organisation',
      organisation: { organisationNumber: '5561234567', name: 'Bilbolaget AB' },
    })

    expect(tenant.fullName).toBe('Bilbolaget AB')
    expect(tenant.birthDate).toBe('')
  })

  it('returns empty address fields when contacts has no address', () => {
    const tenant = toLeaseTerminationTenant({
      ...person('1985-03-14'),
      addresses: [],
    })

    expect(tenant).toMatchObject({ street: '', zipCode: '', city: '' })
  })
})
