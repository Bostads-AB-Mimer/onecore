import * as factory from '../../../../test/factories'
import {
  LeaseTenantDeps,
  mapLeasesWithTenants,
  toLeaseTenant,
} from '../helpers/lease-tenants'

const redactedContact = (contactCode: string) =>
  factory.contactsServiceContact.build({
    contactCode,
    protectedIdentity: true,
    personal: {
      nationalId: 'redacted',
      birthDate: 'redacted',
      firstName: 'redacted',
      lastName: 'redacted',
      fullName: 'redacted',
    },
    communication: {
      phoneNumbers: [],
      emailAddresses: [],
      specialAttention: false,
    },
    addresses: [],
  })

describe('toLeaseTenant', () => {
  it('maps an individual to the lease tenant shape', () => {
    const contact = factory.contactsServiceContact.build()

    expect(toLeaseTenant(contact, true)).toEqual({
      contactCode: contact.contactCode,
      contactKey: contact.contactKey,
      firstName: 'Test',
      lastName: 'Testsson',
      fullName: 'Test Testsson',
      nationalRegistrationNumber: '199001011234',
      birthDate: new Date('1990-01-01'),
      address: {
        street: 'Testgatan 1',
        number: '',
        postalCode: '72345',
        city: 'Västerås',
      },
      phoneNumbers: [
        { phoneNumber: '0701234567', type: 'mobile', isMainNumber: true },
      ],
      emailAddress: 'test@example.com',
      isTenant: true,
      specialAttention: false,
      protectedIdentity: false,
    })
  })

  it('empties the identity fields of a redacted protected identity', () => {
    expect(toLeaseTenant(redactedContact('P1'), true)).toMatchObject({
      firstName: null,
      lastName: null,
      fullName: null,
      nationalRegistrationNumber: '',
      birthDate: null,
      address: undefined,
      phoneNumbers: [],
      emailAddress: null,
      protectedIdentity: true,
      protectedIdentityDetails: 'withheld',
    })
  })

  it('marks an unredacted protected identity as shown', () => {
    const contact = factory.contactsServiceContact.build({
      protectedIdentity: true,
    })

    expect(toLeaseTenant(contact, true)).toMatchObject({
      fullName: 'Test Testsson',
      protectedIdentity: true,
      protectedIdentityDetails: 'shown',
    })
  })

  it('maps an organisation by name and organisation number', () => {
    const { personal: _personal, ...base } =
      factory.contactsServiceContact.build()

    expect(
      toLeaseTenant(
        {
          ...base,
          type: 'organisation',
          organisation: {
            organisationNumber: '5560000000',
            name: 'Bolaget AB',
          },
        },
        true
      )
    ).toMatchObject({
      firstName: null,
      lastName: null,
      fullName: 'Bolaget AB',
      nationalRegistrationNumber: '5560000000',
      birthDate: null,
    })
  })

  it('maps an unparseable birth date to null', () => {
    const contact = factory.contactsServiceContact.build()
    contact.personal.birthDate = 'not a date'

    expect(toLeaseTenant(contact, true).birthDate).toBeNull()
  })

  it('uses the primary email address and falls back to an empty national id', () => {
    const contact = factory.contactsServiceContact.build({
      personal: {
        nationalId: null,
        birthDate: null,
        firstName: 'Test',
        lastName: 'Testsson',
        fullName: 'Test Testsson',
      },
      communication: {
        phoneNumbers: [],
        emailAddresses: [
          { emailAddress: 'other@example.com', type: 'work', isPrimary: false },
          {
            emailAddress: 'main@example.com',
            type: 'private',
            isPrimary: true,
          },
        ],
        specialAttention: true,
      },
    })

    expect(toLeaseTenant(contact, false)).toMatchObject({
      nationalRegistrationNumber: '',
      birthDate: null,
      emailAddress: 'main@example.com',
      specialAttention: true,
      isTenant: false,
    })
  })
})

describe('mapLeasesWithTenants', () => {
  const makeDeps = (
    contacts: ReturnType<typeof factory.contactsServiceContact.build>[]
  ) => {
    const deps: LeaseTenantDeps = {
      contacts: {
        getByContactCodeBatch: jest
          .fn()
          .mockResolvedValue({ ok: true, data: contacts }),
      },
      revealProtectedTenants: jest.fn(async (c) => c),
    }
    return deps
  }

  it('fetches the contacts of all leases in one batch', async () => {
    const a = factory.contactsServiceContact.build()
    const b = factory.contactsServiceContact.build()
    const deps = makeDeps([a, b])

    const result = await mapLeasesWithTenants(
      [
        factory.lease.build({ tenantContactIds: [a.contactCode] }),
        factory.lease.build({
          // Xpand codes can arrive space-padded.
          tenantContactIds: [`${a.contactCode}  `, b.contactCode],
        }),
      ],
      deps
    )

    expect(deps.contacts.getByContactCodeBatch).toHaveBeenCalledTimes(1)
    expect(deps.contacts.getByContactCodeBatch).toHaveBeenCalledWith(
      [a.contactCode, b.contactCode],
      { includePhone: true, includeEmail: true, includeAddress: true }
    )
    expect(result.ok && result.data.map((l) => l.tenants?.length)).toEqual([
      1, 2,
    ])
  })

  it('does not call the contacts service when no lease has contacts', async () => {
    const deps = makeDeps([])

    const result = await mapLeasesWithTenants(
      [factory.lease.build({ tenantContactIds: [] })],
      deps
    )

    expect(deps.contacts.getByContactCodeBatch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, data: [{ tenants: [] }] })
  })

  it('uses the contacts returned by revealProtectedTenants', async () => {
    const redacted = redactedContact('P1')
    const revealed = factory.contactsServiceContact.build({
      contactCode: 'P1',
      protectedIdentity: true,
    })
    const deps = makeDeps([redacted])
    deps.revealProtectedTenants = jest.fn().mockResolvedValue([revealed])

    const result = await mapLeasesWithTenants(
      [factory.lease.build({ tenantContactIds: ['P1'] })],
      deps
    )

    expect(deps.revealProtectedTenants).toHaveBeenCalledWith([redacted])
    expect(result).toMatchObject({
      ok: true,
      data: [
        {
          tenants: [
            { fullName: 'Test Testsson', protectedIdentityDetails: 'shown' },
          ],
        },
      ],
    })
  })

  it('matches contact codes regardless of case and padding', async () => {
    const contact = factory.contactsServiceContact.build({
      contactCode: 'P123456',
    })
    const deps = makeDeps([contact])

    const result = await mapLeasesWithTenants(
      [
        factory.lease.build({ tenantContactIds: ['p123456 '] }),
        factory.lease.build({ tenantContactIds: ['P123456'] }),
      ],
      deps
    )

    expect(deps.contacts.getByContactCodeBatch).toHaveBeenCalledWith(
      [expect.stringMatching(/^p123456$/i)],
      expect.any(Object)
    )
    expect(result).toMatchObject({
      ok: true,
      data: [
        { tenants: [{ contactCode: 'P123456' }] },
        { tenants: [{ contactCode: 'P123456' }] },
      ],
    })
  })

  it('marks lease holders as tenants and the sublet tenant as not', async () => {
    const holder = factory.contactsServiceContact.build()
    const sublet = factory.contactsServiceContact.build()
    const deps = makeDeps([holder, sublet])

    const result = await mapLeasesWithTenants(
      [
        factory.lease.build({
          tenantContactIds: [holder.contactCode],
          subletContactId: sublet.contactCode,
        }),
      ],
      deps
    )

    expect(result).toMatchObject({
      ok: true,
      data: [
        {
          tenants: [
            { contactCode: holder.contactCode, isTenant: true },
            {
              contactCode: sublet.contactCode,
              isTenant: false,
              leaseContactType: 'subletTenant',
            },
          ],
        },
      ],
    })
  })

  it('fails with no-contact when a first-hand tenant is missing', async () => {
    const result = await mapLeasesWithTenants(
      [factory.lease.build({ tenantContactIds: ['P404'] })],
      makeDeps([])
    )

    expect(result).toEqual({ ok: false, err: 'no-contact' })
  })

  it('fails with unknown when the contacts service fails', async () => {
    const deps = makeDeps([])
    deps.contacts.getByContactCodeBatch = jest
      .fn()
      .mockResolvedValue({ ok: false, err: 'unknown', statusCode: 500 })

    const result = await mapLeasesWithTenants([factory.lease.build()], deps)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('fails with unknown when the contacts service throws', async () => {
    const deps = makeDeps([])
    deps.contacts.getByContactCodeBatch = jest
      .fn()
      .mockRejectedValue(new Error('timeout'))

    const result = await mapLeasesWithTenants([factory.lease.build()], deps)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
