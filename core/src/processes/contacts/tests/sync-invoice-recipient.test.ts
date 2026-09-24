import type { Contact } from '@onecore/contacts/domain'
import * as economyAdapter from '../../../adapters/economy-adapter'
import {
  ContactLookup,
  syncInvoiceRecipientToEconomy,
} from '../sync-invoice-recipient'
import * as factory from '../../../../test/factories'

afterEach(() => {
  jest.restoreAllMocks()
})

const makeContactsStub = (
  result: Awaited<ReturnType<ContactLookup['getByContactCode']>>
): ContactLookup => ({
  getByContactCode: jest.fn().mockResolvedValue(result),
})

describe('syncInvoiceRecipientToEconomy', () => {
  it('upserts the contact as a customer with create: true', async () => {
    const contact = factory.contactsServiceContact.build()
    const contacts = makeContactsStub({ ok: true, data: contact })
    const syncSpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await syncInvoiceRecipientToEconomy(
      contacts,
      contact.contactCode
    )

    expect(result).toEqual({ ok: true, data: null })
    expect(contacts.getByContactCode).toHaveBeenCalledWith(contact.contactCode)
    expect(syncSpy).toHaveBeenCalledWith(
      contact.contactCode,
      {
        fullName: contact.personal.fullName,
        street: contact.addresses[0].street,
        zipCode: contact.addresses[0].zipCode,
        city: contact.addresses[0].city,
        emailAddress: contact.communication.emailAddresses[0].emailAddress,
      },
      { create: true }
    )
  })

  it('uses the organisation name as fullName for an organisation contact', async () => {
    const contact: Contact = {
      type: 'organisation',
      contactCode: 'O123',
      contactKey: 'KEY-O123',
      organisation: {
        organisationNumber: '556000-0000',
        name: 'Acme AB',
      },
      communication: {
        phoneNumbers: [],
        emailAddresses: [
          { emailAddress: 'acme@example.com', type: 'work', isPrimary: true },
        ],
        specialAttention: false,
      },
      addresses: [
        {
          street: 'Kontorsgatan 1',
          zipCode: '11122',
          city: 'Stockholm',
          region: null,
          country: 'SE',
          full: 'Kontorsgatan 1, 11122 Stockholm',
        },
      ],
    }
    const contacts = makeContactsStub({ ok: true, data: contact })
    const syncSpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await syncInvoiceRecipientToEconomy(
      contacts,
      contact.contactCode
    )

    expect(result).toEqual({ ok: true, data: null })
    expect(syncSpy).toHaveBeenCalledWith(
      contact.contactCode,
      expect.objectContaining({ fullName: 'Acme AB' }),
      { create: true }
    )
  })

  it('sends undefined street/zipCode/city when the contact has no addresses', async () => {
    const contact = factory.contactsServiceContact.build({ addresses: [] })
    const contacts = makeContactsStub({ ok: true, data: contact })
    const syncSpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await syncInvoiceRecipientToEconomy(
      contacts,
      contact.contactCode
    )

    expect(result).toEqual({ ok: true, data: null })
    expect(syncSpy).toHaveBeenCalledWith(
      contact.contactCode,
      {
        fullName: contact.personal.fullName,
        street: undefined,
        zipCode: undefined,
        city: undefined,
        emailAddress: contact.communication.emailAddresses[0].emailAddress,
      },
      { create: true }
    )
  })

  it('falls back to the only email when none is marked primary', async () => {
    const contact = factory.contactsServiceContact.build({
      communication: {
        phoneNumbers: [],
        emailAddresses: [
          {
            emailAddress: 'notprimary@example.com',
            type: 'private',
            isPrimary: false,
          },
        ],
        specialAttention: false,
      },
    })
    const contacts = makeContactsStub({ ok: true, data: contact })
    const syncSpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await syncInvoiceRecipientToEconomy(
      contacts,
      contact.contactCode
    )

    expect(result).toEqual({ ok: true, data: null })
    expect(syncSpy).toHaveBeenCalledWith(
      contact.contactCode,
      expect.objectContaining({ emailAddress: 'notprimary@example.com' }),
      { create: true }
    )
  })

  it('prefers the primary email over an earlier non-primary one', async () => {
    const contact = factory.contactsServiceContact.build({
      communication: {
        phoneNumbers: [],
        emailAddresses: [
          {
            emailAddress: 'notprimary@example.com',
            type: 'private',
            isPrimary: false,
          },
          {
            emailAddress: 'primary@example.com',
            type: 'work',
            isPrimary: true,
          },
        ],
        specialAttention: false,
      },
    })
    const contacts = makeContactsStub({ ok: true, data: contact })
    const syncSpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await syncInvoiceRecipientToEconomy(
      contacts,
      contact.contactCode
    )

    expect(result).toEqual({ ok: true, data: null })
    expect(syncSpy).toHaveBeenCalledWith(
      contact.contactCode,
      expect.objectContaining({ emailAddress: 'primary@example.com' }),
      { create: true }
    )
  })

  describe('failures', () => {
    const contact = factory.contactsServiceContact.build()

    const cases: Array<{
      name: string
      contactsResult: Awaited<ReturnType<ContactLookup['getByContactCode']>>
      economyResult?: Awaited<
        ReturnType<typeof economyAdapter.syncContactToEconomy>
      >
      expected: {
        ok: false
        err: 'contact-not-found' | 'sync-failed'
        detail: string
      }
    }> = [
      {
        name: 'contact cannot be fetched (not-found)',
        contactsResult: { ok: false, err: 'not-found' },
        expected: { ok: false, err: 'contact-not-found', detail: 'not-found' },
      },
      {
        name: 'contact lookup returns an infrastructure failure (unknown)',
        contactsResult: { ok: false, err: 'unknown' },
        expected: { ok: false, err: 'sync-failed', detail: 'unknown' },
      },
      {
        name: 'economy sync fails',
        contactsResult: { ok: true, data: contact },
        economyResult: { ok: false, err: 'sync-failed' },
        expected: { ok: false, err: 'sync-failed', detail: 'sync-failed' },
      },
    ]

    it.each(cases)(
      'returns $expected.err when $name',
      async ({ contactsResult, economyResult, expected }) => {
        const contacts = makeContactsStub(contactsResult)
        // Given a default resolved value even when this case doesn't expect
        // it to be reached: if a regression stopped the short-circuit on a
        // failed contact lookup, this spy — not a real network call — would
        // catch it.
        const syncSpy = jest
          .spyOn(economyAdapter, 'syncContactToEconomy')
          .mockResolvedValue(
            economyResult ?? { ok: true, data: { skipped: false } }
          )

        const result = await syncInvoiceRecipientToEconomy(
          contacts,
          contact.contactCode
        )

        expect(result).toEqual(expected)
        if (!economyResult) expect(syncSpy).not.toHaveBeenCalled()
      }
    )

    it('returns sync-failed when the contact lookup rejects', async () => {
      // The production contacts adapter does not catch request exceptions on
      // reads, so a network error rejects rather than returning a result. An
      // escaping rejection would answer the caseworker with an unstructured
      // 500 instead of the 502 propagation-failed the route promises.
      const contacts: ContactLookup = {
        getByContactCode: jest
          .fn()
          .mockRejectedValue(new Error('socket hang up')),
      }
      const syncSpy = jest
        .spyOn(economyAdapter, 'syncContactToEconomy')
        .mockResolvedValue({ ok: true, data: { skipped: false } })

      const result = await syncInvoiceRecipientToEconomy(contacts, 'P222')

      expect(result).toEqual({
        ok: false,
        err: 'sync-failed',
        detail: 'contact-lookup-threw',
      })
      expect(syncSpy).not.toHaveBeenCalled()
    })
  })
})
