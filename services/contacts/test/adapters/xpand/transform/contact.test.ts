import { transformDbContactRows } from '@xpand/transform'
import { DbContactRow } from '@xpand/db-model'

const row = (overrides: Partial<DbContactRow> = {}): DbContactRow => ({
  contactCode: 'P123456',
  contactKey: '_KEY',
  objectKey: '_OBJ',
  nid: '199001011234',
  firstName: 'Fiktiv',
  lastName: 'Person',
  fullName: 'Person Fiktiv',
  birthDate: '1990-01-01',
  street: '',
  postalCode: '',
  city: '',
  protectedIdentity: null,
  specialAttention: undefined,
  isLeaseHolder: 0,
  addressId: '_ADR',
  adress1: 'Exempelvägen 1',
  adress3: '722 99',
  adress4: 'Västerås',
  ...overrides,
})

const unprotected = { protectedIdentity: null }
const protectedRow = { protectedIdentity: new Date('2020-01-01') }

describe('transformDbContactRows: protected identity', () => {
  it('reports an unprotected individual as not protected', () => {
    const [contact] = transformDbContactRows([row(unprotected)])

    expect(contact.protectedIdentity).toBe(false)
    expect(contact.type === 'individual' && contact.personal.fullName).toBe(
      'Person Fiktiv'
    )
  })

  it('redacts a protected individual that is not exempt', () => {
    const [contact] = transformDbContactRows([row(protectedRow)])

    expect(contact.protectedIdentity).toBe(true)
    expect(contact.type === 'individual' && contact.personal).toEqual({
      firstName: 'redacted',
      lastName: 'redacted',
      fullName: 'redacted',
      nationalId: 'redacted',
      birthDate: 'redacted',
    })
    expect(contact.addresses).toEqual([])
  })

  it('does not redact a protected tenant', () => {
    const [contact] = transformDbContactRows([
      row({ ...protectedRow, isLeaseHolder: 1 }),
    ])

    expect(contact.protectedIdentity).toBe(true)
    expect(contact.type === 'individual' && contact.personal.fullName).toBe(
      'Person Fiktiv'
    )
    expect(contact.addresses).toHaveLength(1)
  })

  it('does not redact a protected invoice recipient, matching on the trimmed code', () => {
    const [contact] = transformDbContactRows(
      [row({ ...protectedRow, contactCode: 'P123456   ' })],
      new Set(['P123456'])
    )

    expect(contact.protectedIdentity).toBe(true)
    expect(contact.type === 'individual' && contact.personal.nationalId).toBe(
      '199001011234'
    )
  })

  it('never reports an organisation as protected', () => {
    const [contact] = transformDbContactRows([
      row({ ...protectedRow, contactCode: 'F123456' }),
    ])

    expect(contact.type).toBe('organisation')
    expect(contact.protectedIdentity).toBe(false)
  })
})
