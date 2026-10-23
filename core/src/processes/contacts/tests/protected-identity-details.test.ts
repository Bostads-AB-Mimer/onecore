import { ContactLookup } from '../sync-invoice-recipient'
import { withProtectedIdentityDetails } from '../protected-identity-details'
import * as factory from '../../../../test/factories'

const makeContactsStub = (
  result: Awaited<ReturnType<ContactLookup['getByContactCode']>>
): ContactLookup => ({
  getByContactCode: jest.fn().mockResolvedValue(result),
})

// A legacy leasing record of a protected identity: leasing leaves the
// identity fields out, so at runtime they are undefined despite the type.
const redactedLegacy = (protectedIdentity: boolean) => ({
  contactCode: 'P158769',
  protectedIdentity,
  firstName: undefined as unknown as string,
  lastName: undefined as unknown as string,
  fullName: undefined as unknown as string,
  nationalRegistrationNumber: undefined as unknown as string,
  birthDate: undefined as unknown as Date,
  isTenant: true,
})

describe('withProtectedIdentityDetails', () => {
  it('leaves an unprotected contact alone without calling the contacts service', async () => {
    const contacts = makeContactsStub({ ok: false, err: 'unknown' })
    const legacy = redactedLegacy(false)

    expect(await withProtectedIdentityDetails(contacts, legacy)).toBe(legacy)
    expect(contacts.getByContactCode).not.toHaveBeenCalled()
  })

  it('fills in the identity of a protected contact the contacts service shows', async () => {
    const contact = factory.contactsServiceContact.build({
      contactCode: 'P158769',
      protectedIdentity: true,
    })
    const contacts = makeContactsStub({ ok: true, data: contact })

    const result = await withProtectedIdentityDetails(
      contacts,
      redactedLegacy(true)
    )

    expect(contacts.getByContactCode).toHaveBeenCalledWith('P158769')
    expect(result).toEqual({
      contactCode: 'P158769',
      protectedIdentity: true,
      isTenant: true,
      firstName: 'Test',
      lastName: 'Testsson',
      fullName: 'Test Testsson',
      nationalRegistrationNumber: '199001011234',
      birthDate: new Date('1990-01-01'),
    })
  })

  it('stays redacted when the contacts service redacts the contact too', async () => {
    const contact = factory.contactsServiceContact.build({
      protectedIdentity: true,
      personal: {
        firstName: 'redacted',
        lastName: 'redacted',
        fullName: 'redacted',
        nationalId: 'redacted',
        birthDate: 'redacted',
      },
    })
    const legacy = redactedLegacy(true)

    expect(
      await withProtectedIdentityDetails(
        makeContactsStub({ ok: true, data: contact }),
        legacy
      )
    ).toBe(legacy)
  })

  it('fails closed when the contacts service fails', async () => {
    const legacy = redactedLegacy(true)

    expect(
      await withProtectedIdentityDetails(
        makeContactsStub({ ok: false, err: 'unknown' }),
        legacy
      )
    ).toBe(legacy)
  })

  it('fails closed when the contacts lookup throws', async () => {
    const legacy = redactedLegacy(true)
    const contacts: ContactLookup = {
      getByContactCode: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }

    expect(await withProtectedIdentityDetails(contacts, legacy)).toBe(legacy)
  })
})
