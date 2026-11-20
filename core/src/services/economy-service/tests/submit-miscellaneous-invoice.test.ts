import { economy, SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'
import * as economyAdapter from '../../../adapters/economy-adapter'
import * as syncInvoiceRecipient from '../../../processes/contacts/sync-invoice-recipient'
import type { ContactLookup } from '../../../processes/contacts/sync-invoice-recipient'
import { submitMiscellaneousInvoiceCreatingCustomer } from '../submit-miscellaneous-invoice'
import * as factory from '../../../../test/factories'

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

afterEach(() => {
  jest.restoreAllMocks()
})

type SubmitResult = Awaited<
  ReturnType<typeof economyAdapter.submitMiscellaneousInvoice>
>
type SyncResult = Awaited<
  ReturnType<typeof syncInvoiceRecipient.syncInvoiceRecipientToEconomy>
>

const notFound: SubmitResult = {
  ok: false,
  err: SubmitMiscellaneousInvoiceErrorCodes.XledgerCustomerNotFound,
  statusCode: 404,
}
const unknown: SubmitResult = {
  ok: false,
  err: SubmitMiscellaneousInvoiceErrorCodes.Unknown,
}

const makeContactsStub = (): ContactLookup => ({
  getByContactCode: jest.fn().mockResolvedValue({
    ok: true,
    data: factory.contactsServiceContact.build(),
  }),
})

const makeInvoice = (): economy.MiscellaneousInvoicePayload => {
  const contact = factory.contactsServiceContact.build()
  return {
    reference: 'Ref 1',
    invoiceDate: new Date('2026-11-01'),
    contactCode: contact.contactCode,
    tenantName: 'Test Testsson',
    leaseId: '123-456-789/1',
    invoiceRows: [{ amount: 1, price: '100', text: 'Rad' }],
    administrativeCosts: false,
  }
}

const attachment = {
  filepath: '/tmp/upload',
  originalFilename: 'underlag.pdf',
}

const setup = (
  submitResults: SubmitResult[],
  syncResult?: SyncResult | Error
) => {
  const submitSpy = jest.spyOn(economyAdapter, 'submitMiscellaneousInvoice')
  for (const r of submitResults) submitSpy.mockResolvedValueOnce(r)
  const syncSpy = jest.spyOn(
    syncInvoiceRecipient,
    'syncInvoiceRecipientToEconomy'
  )
  if (syncResult instanceof Error) syncSpy.mockRejectedValue(syncResult)
  else if (syncResult) syncSpy.mockResolvedValue(syncResult)
  return { submitSpy, syncSpy }
}

describe('submitMiscellaneousInvoiceCreatingCustomer', () => {
  it('returns the first send when it succeeds, without creating a customer', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy, syncSpy } = setup([
      { ok: true, data: [{ node: { dbId: 11 } }] },
    ])

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({ ok: true, data: [{ node: { dbId: 11 } }] })
    expect(syncSpy).not.toHaveBeenCalled()
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('returns unknown from the first send without creating a customer', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy, syncSpy } = setup([unknown])

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({ ok: false, err: 'unknown' })
    expect(syncSpy).not.toHaveBeenCalled()
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('creates the customer on not-found and returns the second send', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { syncSpy } = setup(
      [notFound, { ok: true, data: [{ node: { dbId: 22 } }] }],
      { ok: true, data: null }
    )

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({ ok: true, data: [{ node: { dbId: 22 } }] })
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(contacts, invoice.contactCode)
  })

  it('resends the same invoice and attachment after creating the customer', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy } = setup(
      [notFound, { ok: true, data: [{ node: { dbId: 22 } }] }],
      { ok: true, data: null }
    )

    await submitMiscellaneousInvoiceCreatingCustomer(invoice, attachment, {
      contacts,
    })

    expect(submitSpy).toHaveBeenCalledTimes(2)
    expect(submitSpy.mock.calls[0][0]).toBe(invoice)
    expect(submitSpy.mock.calls[0][1]).toBe(attachment)
    expect(submitSpy.mock.calls[1][0]).toBe(invoice)
    expect(submitSpy.mock.calls[1][1]).toBe(attachment)
  })

  it('returns customer-creation-failed when the contact is not found', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy } = setup([notFound], {
      ok: false,
      err: 'contact-not-found',
      detail: 'not-found',
    })

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({
      ok: false,
      err: 'customer-creation-failed',
      detail: 'contact-not-found',
    })
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('returns customer-creation-failed when the economy sync fails', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy } = setup([notFound], {
      ok: false,
      err: 'sync-failed',
      detail: 'unknown',
    })

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({
      ok: false,
      err: 'customer-creation-failed',
      detail: 'sync-failed',
    })
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('returns customer-creation-failed when creating the customer throws', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy } = setup([notFound], new Error('boom'))

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({
      ok: false,
      err: 'customer-creation-failed',
      detail: 'sync-failed',
    })
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('returns customer-not-found-after-create when the resend is still not found', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy, syncSpy } = setup([notFound, notFound], {
      ok: true,
      data: null,
    })

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({
      ok: false,
      err: 'customer-not-found-after-create',
    })
    expect(submitSpy).toHaveBeenCalledTimes(2)
    expect(syncSpy).toHaveBeenCalledTimes(1)
  })

  it('returns unknown from the resend without trying again', async () => {
    const invoice = makeInvoice()
    const contacts = makeContactsStub()
    const { submitSpy } = setup([notFound, unknown, unknown], {
      ok: true,
      data: null,
    })

    const result = await submitMiscellaneousInvoiceCreatingCustomer(
      invoice,
      attachment,
      { contacts }
    )

    expect(result).toEqual({ ok: false, err: 'unknown' })
    expect(submitSpy).toHaveBeenCalledTimes(2)
  })
})
