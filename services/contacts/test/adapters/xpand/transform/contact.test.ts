import { transformDbContactRows } from '@xpand/transform'
import { DbContactRow } from '@xpand/db-model'
import { placeholderPhoneNumber } from '@onecore/utilities'

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

  it('does not redact a protected contact whose code is exempt', () => {
    const [contact] = transformDbContactRows(
      [row(protectedRow)],
      new Set(['P123456'])
    )

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

describe('transformDbContactRows: contact details mode', () => {
  const withDetails = (overrides: Partial<DbContactRow> = {}) =>
    row({
      emailId: '_EM',
      emailAddress: 'fiktiv.person@example.com',
      emailType: 'epost',
      isPrimaryEmail: 1,
      phoneId: '_PH',
      phoneNumber: 'Sonen Ola: 070-123 45 67',
      phoneType: 'mobil',
      isPrimaryPhone: 1,
      ...overrides,
    })

  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    delete process.env.CONTACT_DETAILS__MODE
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const setMode = (mode: string) => {
    process.env.CONTACT_DETAILS__MODE = mode
  }

  it('redacts email and phone when the mode is unset outside production', () => {
    const [contact] = transformDbContactRows([withDetails()])

    expect(contact.communication.emailAddresses).toEqual([
      { emailAddress: 'redacted', type: 'unspecified', isPrimary: true },
    ])
    expect(contact.communication.phoneNumbers).toEqual([
      {
        phoneNumber: 'redacted',
        type: 'mobile',
        isPrimary: true,
        comment: 'Sonen Ola',
      },
    ])
  })

  it('gives a placeholder email built from the contact code', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows([withDetails()])

    expect(contact.communication.emailAddresses).toEqual([
      {
        emailAddress: 'redacted+P123456@example.invalid',
        type: 'unspecified',
        isPrimary: true,
      },
    ])
  })

  it('keeps isPrimary false on a placeholder email', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows([
      withDetails({ isPrimaryEmail: 0 }),
    ])

    expect(contact.communication.emailAddresses).toEqual([
      {
        emailAddress: 'redacted+P123456@example.invalid',
        type: 'unspecified',
        isPrimary: false,
      },
    ])
  })

  it('gives a placeholder phone number, keeps type and isPrimary and drops the comment', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows([withDetails()])
    const [phone] = contact.communication.phoneNumbers

    expect(contact.communication.phoneNumbers).toHaveLength(1)
    expect(phone.phoneNumber).toBe(placeholderPhoneNumber('P123456'))
    expect(phone.type).toBe('mobile')
    expect(phone.isPrimary).toBe(true)
    expect(phone.comment).toBeUndefined()
  })

  it('gives the same placeholder email for a contact code with trailing spaces', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows([
      withDetails({ contactCode: 'P123456   ' }),
    ])

    expect(contact.communication.emailAddresses[0].emailAddress).toBe(
      'redacted+P123456@example.invalid'
    )
  })

  it('invents no rows in placeholder mode when the contact has none', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows([row()])

    expect(contact.communication.emailAddresses).toEqual([])
    expect(contact.communication.phoneNumbers).toEqual([])
  })

  it('returns the Xpand email and phone unchanged in real mode', () => {
    setMode('real')

    const [contact] = transformDbContactRows([withDetails()])

    expect(contact.communication.emailAddresses).toEqual([
      {
        emailAddress: 'fiktiv.person@example.com',
        type: 'unspecified',
        isPrimary: true,
      },
    ])
    expect(contact.communication.phoneNumbers).toEqual([
      {
        phoneNumber: '070-123 45 67',
        type: 'mobile',
        isPrimary: true,
        comment: 'Sonen Ola',
      },
    ])
  })

  it('returns real email and phone when the mode is unset in production', () => {
    process.env.NODE_ENV = 'production'

    const [contact] = transformDbContactRows([withDetails()])

    expect(contact.communication.emailAddresses[0].emailAddress).toBe(
      'fiktiv.person@example.com'
    )
    expect(contact.communication.phoneNumbers[0].phoneNumber).toBe(
      '070-123 45 67'
    )
  })

  it.each(['real', 'placeholder', 'redacted'])(
    'hides email and phone of a protected individual that is not exempt in %s mode',
    (mode) => {
      setMode(mode)

      const [contact] = transformDbContactRows([withDetails(protectedRow)])

      expect(contact.communication.emailAddresses).toEqual([])
      expect(contact.communication.phoneNumbers).toEqual([])
    }
  )

  it('gives an exempt protected individual a placeholder email', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows(
      [withDetails(protectedRow)],
      new Set(['P123456'])
    )

    expect(contact.communication.emailAddresses).toEqual([
      {
        emailAddress: 'redacted+P123456@example.invalid',
        type: 'unspecified',
        isPrimary: true,
      },
    ])
  })

  it('gives an organisation a placeholder email built from its code', () => {
    setMode('placeholder')

    const [contact] = transformDbContactRows([
      withDetails({ contactCode: 'F123456' }),
    ])

    expect(contact.type).toBe('organisation')
    expect(contact.communication.emailAddresses).toEqual([
      {
        emailAddress: 'redacted+F123456@example.invalid',
        type: 'unspecified',
        isPrimary: true,
      },
    ])
  })
})
