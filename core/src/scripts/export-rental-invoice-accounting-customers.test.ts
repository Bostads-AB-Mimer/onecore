import type { Contact } from '@onecore/contacts/domain'
import * as economyAdapter from '../adapters/economy-adapter'
import { contactsAdapter } from '../adapters/contacts-adapter'
import * as leasesAdapter from '../adapters/leasing-adapter/leases'
import type { ContactLookup } from '../processes/contacts/sync-invoice-recipient'
import {
  createInvoiceRecipients,
  createMissingInvoiceRecipients,
} from './export-rental-invoice-accounting-customers'
import * as factory from '../../test/factories'

afterEach(() => {
  jest.restoreAllMocks()
})

const COMPANY_ID = '001'

const lookupOf = (
  contacts: Contact[]
): ContactLookup & {
  getByContactCode: jest.Mock
} => ({
  getByContactCode: jest.fn(async (contactCode: string) => {
    const contact = contacts.find((c) => c.contactCode === contactCode)
    return contact
      ? { ok: true as const, data: contact }
      : { ok: false as const, err: 'not-found' as const }
  }),
})

const mockMissingCustomers = (missingCustomerCodes: string[]) =>
  jest
    .spyOn(economyAdapter, 'getInvoiceRecipientsMissingAsCustomers')
    .mockResolvedValue({
      ok: true,
      data: { recipients: missingCustomerCodes.length, missingCustomerCodes },
    })

const mockSyncCreated = () =>
  jest
    .spyOn(economyAdapter, 'syncContactToEconomy')
    .mockResolvedValue({ ok: true, data: { skipped: false, undo: null } })

describe('createMissingInvoiceRecipients', () => {
  it('creates a recipient the read route reports missing', async () => {
    const contact = factory.contactsServiceContact.build()
    const contacts = lookupOf([contact])
    const readSpy = mockMissingCustomers([contact.contactCode])
    const syncSpy = mockSyncCreated()

    const report = await createMissingInvoiceRecipients(COMPANY_ID, {
      contacts,
    })

    expect(readSpy).toHaveBeenCalledWith(COMPANY_ID)
    expect(contacts.getByContactCode).toHaveBeenCalledTimes(1)
    expect(contacts.getByContactCode).toHaveBeenCalledWith(contact.contactCode)
    expect(syncSpy).toHaveBeenCalledTimes(1)
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
    expect(report).toEqual({
      created: [contact.contactCode],
      updated: [],
      failed: [],
      attempted: [contact.contactCode],
    })
  })

  it('makes no Contacts or sync call when nothing is missing', async () => {
    const contacts = lookupOf([])
    mockMissingCustomers([])
    const syncSpy = mockSyncCreated()

    const report = await createMissingInvoiceRecipients(COMPANY_ID, {
      contacts,
    })

    expect(contacts.getByContactCode).not.toHaveBeenCalled()
    expect(syncSpy).not.toHaveBeenCalled()
    expect(report).toEqual({
      created: [],
      updated: [],
      failed: [],
      attempted: [],
    })
  })

  it('reports a lookup failure without syncing or throwing', async () => {
    const contacts = lookupOf([])
    jest
      .spyOn(economyAdapter, 'getInvoiceRecipientsMissingAsCustomers')
      .mockResolvedValue({
        ok: false,
        err: 'xledger-failed',
        statusCode: 502,
        detail: 'xledger down',
      })
    const syncSpy = mockSyncCreated()

    const report = await createMissingInvoiceRecipients(COMPANY_ID, {
      contacts,
    })

    expect(contacts.getByContactCode).not.toHaveBeenCalled()
    expect(syncSpy).not.toHaveBeenCalled()
    expect(report).toEqual({
      created: [],
      updated: [],
      failed: [],
      attempted: [],
      lookupFailure: expect.stringContaining('xledger-failed'),
    })
  })
})

describe('createInvoiceRecipients', () => {
  it('reports a code missing in Contacts and still creates the others', async () => {
    const missing = factory.contactsServiceContact.build()
    const found = factory.contactsServiceContact.build()
    const contacts = lookupOf([found])
    const syncSpy = mockSyncCreated()

    const report = await createInvoiceRecipients(
      [missing.contactCode, found.contactCode],
      { contacts }
    )

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(
      found.contactCode,
      expect.objectContaining({ fullName: found.personal.fullName }),
      { create: true }
    )
    expect(report).toEqual({
      created: [found.contactCode],
      updated: [],
      failed: [
        { contactCode: missing.contactCode, reason: 'contact-not-found' },
      ],
    })
  })

  it('reports a failed sync and still runs the other codes', async () => {
    const failing = factory.contactsServiceContact.build()
    const other = factory.contactsServiceContact.build()
    const contacts = lookupOf([failing, other])
    const syncSpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockImplementation(async (contactCode) =>
        contactCode === failing.contactCode
          ? { ok: false, err: 'sync-failed' }
          : { ok: true, data: { skipped: false, undo: null } }
      )

    const report = await createInvoiceRecipients(
      [failing.contactCode, other.contactCode],
      { contacts }
    )

    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(report).toEqual({
      created: [other.contactCode],
      updated: [],
      failed: [{ contactCode: failing.contactCode, reason: 'sync-failed' }],
    })
  })

  it('lists a customer that already existed under updated, not created', async () => {
    const contact = factory.contactsServiceContact.build()
    const contacts = lookupOf([contact])
    jest.spyOn(economyAdapter, 'syncContactToEconomy').mockResolvedValue({
      ok: true,
      data: {
        skipped: false,
        undo: {
          previous: {
            fullName: 'Gammal Kund',
            street: null,
            zipCode: null,
            city: null,
            emailAddress: null,
          },
        },
      },
    })

    const report = await createInvoiceRecipients([contact.contactCode], {
      contacts,
    })

    expect(report).toEqual({
      created: [],
      updated: [contact.contactCode],
      failed: [],
    })
  })

  it('syncs a protected recipient still redacted after the reveal as Contacts returned it', async () => {
    const redacted = factory.contactsServiceContact.build({
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
    const getByContactCode = jest
      .spyOn(contactsAdapter, 'getByContactCode')
      .mockResolvedValue({ ok: true, data: redacted })
    const revealSpy = jest.spyOn(contactsAdapter, 'getByContactCodeBatch')
    // No tenant lease, so the reveal leaves the contact redacted.
    jest.spyOn(leasesAdapter, 'getLeasesByContactCode').mockResolvedValue([])
    const syncSpy = mockSyncCreated()

    const report = await createInvoiceRecipients([redacted.contactCode])

    expect(getByContactCode).toHaveBeenCalledWith(redacted.contactCode)
    expect(revealSpy).not.toHaveBeenCalled()
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(
      redacted.contactCode,
      {
        fullName: 'redacted',
        street: undefined,
        zipCode: undefined,
        city: undefined,
        emailAddress: undefined,
      },
      { create: true }
    )
    expect(report).toEqual({
      created: [redacted.contactCode],
      updated: [],
      failed: [],
    })
  })
})
