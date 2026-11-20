import axios from 'axios'
jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      warn: () => {
        return
      },
      error: () => {
        return
      },
    },
    loggedAxios: axios,
    axiosTypes: axios,
    errorMessage: (err: unknown) => String(err),
    generateRouteMetadata: jest.fn(() => ({})),
    makeSuccessResponseBody: jest.fn((content, metadata) => ({
      content,
      ...metadata,
    })),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import type { Contact } from '@onecore/contacts/domain'
import { Invoice, Lease } from '@onecore/types'

import { routes } from '../index'
import * as economyAdapter from '../../../adapters/economy-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import { tenantAwareContactLookup } from '../../../processes/contacts/protected-tenants'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const pdf = Buffer.from('%PDF-1.4 mock')

// Only the fields the send route reads.
const rentNotice = {
  invoiceId: '552606001476999',
  type: 'Regular',
  reference: 'P174691',
  leaseIds: ['705-024-01-0101/14'],
  expirationDate: '2026-02-28T00:00:00.000Z',
  amount: 5432,
} as unknown as Invoice

const miscellaneousInvoice = {
  invoiceId: '1234567',
  type: 'Other',
  reference: 'P174691',
  leaseIds: [],
  expirationDate: '2026-03-31T00:00:00.000Z',
  amount: 850,
} as unknown as Invoice

// Only the fields the send route reads.
const lease = {
  tenantContactIds: ['P174691'],
  rentalObject: { address: 'Testgatan 1' },
} as unknown as Lease

const individual = (
  overrides: Partial<{
    emails: { emailAddress: string; isPrimary: boolean }[]
    protectedIdentity: boolean
    fullName: string
  }> = {}
) =>
  ({
    contactCode: 'P174691',
    type: 'individual',
    protectedIdentity: overrides.protectedIdentity ?? false,
    personal: {
      firstName: 'Anna',
      lastName: 'Andersson',
      fullName: overrides.fullName ?? 'Anna Andersson',
    },
    communication: {
      emailAddresses: (
        overrides.emails ?? [
          { emailAddress: 'old@example.com', isPrimary: false },
          { emailAddress: 'anna@example.com', isPrimary: true },
        ]
      ).map((e) => ({ ...e, type: 'private' })),
      phoneNumbers: [],
      specialAttention: false,
    },
  }) as unknown as Contact

// The rent system has no invoice with this number.
const notInRentSystem = () => {
  jest
    .spyOn(economyAdapter, 'getInvoiceByOcr')
    .mockResolvedValue({ ok: false, err: 'not-found' })
  jest
    .spyOn(economyAdapter, 'getInvoicePdf')
    .mockResolvedValue({ ok: false, err: 'not-found' })
}

const send = (
  invoiceId: string,
  body?: { invoiceType?: unknown; contactCode?: unknown }
) => request(app.callback()).post(`/invoices/${invoiceId}/send`).send(body)

describe('POST /invoices/:invoiceId/send', () => {
  let sendEmail: jest.SpyInstance

  beforeEach(() => {
    sendEmail = jest
      .spyOn(communicationAdapter, 'sendInvoiceNotificationEmail')
      .mockResolvedValue({ ok: true, data: null })
  })

  afterEach(() => jest.restoreAllMocks())

  describe('a rent notice', () => {
    let getContact: jest.SpyInstance

    beforeEach(() => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValue({ ok: true, data: rentNotice })
      jest.spyOn(economyAdapter, 'getInvoicePdf').mockResolvedValue({
        ok: true,
        data: { data: pdf, contentDisposition: '' },
      })
      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(lease)
      getContact = jest
        .spyOn(tenantAwareContactLookup, 'getByContactCode')
        .mockResolvedValue({ ok: true, data: individual() })
    })

    it('is emailed with the rent notice PDF attached', async () => {
      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({ sent: true })
      expect(economyAdapter.getInvoicePdf).toHaveBeenCalledWith(
        rentNotice.invoiceId
      )
      expect(getContact).toHaveBeenCalledWith('P174691')
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Anna',
          address: 'Testgatan 1',
          invoiceNumber: rentNotice.invoiceId,
          dueDate: '2026-02-28',
          totalAmount: '5432',
          attachments: [
            expect.objectContaining({
              filename: `faktura-${rentNotice.invoiceId}.pdf`,
              content: pdf.toString('base64'),
            }),
          ],
        })
      )
    })

    it('is emailed without a ledger lookup, so it works before the rent notice reaches the ledger', async () => {
      const getLedgerInvoice = jest.spyOn(
        economyAdapter,
        'getInvoiceByInvoiceId'
      )

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(200)
      expect(getLedgerInvoice).not.toHaveBeenCalled()
      expect(economyAdapter.getInvoiceByOcr).toHaveBeenCalledTimes(1)
    })

    it('answers 500 unknown without a ledger lookup when the rent notice lookup fails', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      const getLedgerInvoice = jest.spyOn(
        economyAdapter,
        'getInvoiceByInvoiceId'
      )

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(500)
      expect(res.body.reason).toBe('unknown')
      expect(getLedgerInvoice).not.toHaveBeenCalled()
      expect(sendEmail).not.toHaveBeenCalled()
    })

    describe('on a lease with two tenants', () => {
      beforeEach(() => {
        jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue({
          ...lease,
          tenantContactIds: ['P174691', 'P200002'],
        } as unknown as Lease)
      })

      it('is emailed to the tenant whose ledger it was sent from', async () => {
        const res = await send(rentNotice.invoiceId, {
          contactCode: 'p200002 ',
        })

        expect(res.status).toBe(200)
        expect(getContact).toHaveBeenCalledWith('P200002')
        expect(getContact).toHaveBeenCalledTimes(1)
      })

      it('is emailed to the first tenant when no contact is given', async () => {
        const res = await send(rentNotice.invoiceId)

        expect(res.status).toBe(200)
        expect(getContact).toHaveBeenCalledWith('P174691')
      })

      it('answers 422 no-recipient for a contact that is not a tenant on the lease', async () => {
        const res = await send(rentNotice.invoiceId, { contactCode: 'P999999' })

        expect(res.status).toBe(422)
        expect(res.body.reason).toBe('no-recipient')
        expect(getContact).not.toHaveBeenCalled()
        expect(sendEmail).not.toHaveBeenCalled()
      })
    })

    it('answers 404 pdf-not-found when there is no rent notice PDF', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoicePdf')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(404)
      expect(res.body.reason).toBe('pdf-not-found')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('answers 422 no-recipient when the lease is missing', async () => {
      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(null)

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(422)
      expect(res.body.reason).toBe('no-recipient')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('answers 422 no-email when the tenant has no email address', async () => {
      getContact.mockResolvedValue({
        ok: true,
        data: individual({ emails: [] }),
      })

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(422)
      expect(res.body.reason).toBe('no-email')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('does not email a protected identity the contacts service returned redacted', async () => {
      getContact.mockResolvedValue({
        ok: true,
        data: individual({
          protectedIdentity: true,
          fullName: 'redacted',
          emails: [{ emailAddress: 'redacted', isPrimary: true }],
        }),
      })

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(422)
      expect(res.body.reason).toBe('no-recipient')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('does not email when the contact lookup fails', async () => {
      getContact.mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(500)
      expect(res.body.reason).toBe('unknown')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('answers 500 send-failed when the email cannot be sent', async () => {
      sendEmail.mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await send(rentNotice.invoiceId)

      expect(res.status).toBe(500)
      expect(res.body.reason).toBe('send-failed')
    })
  })

  describe('a miscellaneous invoice', () => {
    let getContact: jest.SpyInstance

    beforeEach(() => {
      notInRentSystem()
      jest
        .spyOn(economyAdapter, 'getInvoiceByInvoiceId')
        .mockResolvedValue({ ok: true, data: miscellaneousInvoice })
      jest
        .spyOn(economyAdapter, 'getInvoiceFile')
        .mockResolvedValue({ ok: true, data: pdf })
      getContact = jest
        .spyOn(tenantAwareContactLookup, 'getByContactCode')
        .mockResolvedValue({ ok: true, data: individual() })
    })

    it('is emailed to the primary address of the customer it is billed to, with the ledger PDF', async () => {
      const res = await send(miscellaneousInvoice.invoiceId)

      expect(res.status).toBe(200)
      expect(getContact).toHaveBeenCalledWith('P174691')
      expect(economyAdapter.getInvoiceFile).toHaveBeenCalledWith('1234567')
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Anna',
          address: '',
          invoiceNumber: '1234567',
          dueDate: '2026-03-31',
          totalAmount: '850',
          attachments: [
            expect.objectContaining({ content: pdf.toString('base64') }),
          ],
        })
      )
    })

    it('skips the rent notice lookup when the caller says it is a miscellaneous invoice', async () => {
      const res = await send(miscellaneousInvoice.invoiceId, {
        invoiceType: 'Other',
      })

      expect(res.status).toBe(200)
      expect(economyAdapter.getInvoiceByOcr).not.toHaveBeenCalled()
      expect(economyAdapter.getInvoicePdf).not.toHaveBeenCalled()
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceNumber: '1234567' })
      )
    })

    it('is emailed to the customer it is billed to, whatever contact is given', async () => {
      const res = await send(miscellaneousInvoice.invoiceId, {
        invoiceType: 'Other',
        contactCode: 'P999999',
      })

      expect(res.status).toBe(200)
      expect(getContact).toHaveBeenCalledWith('P174691')
    })

    it('answers 404 pdf-not-found when the ledger has no file', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceFile')
        .mockResolvedValue({ ok: false, err: 'file-not-found' })

      const res = await send(miscellaneousInvoice.invoiceId)

      expect(res.status).toBe(404)
      expect(res.body.reason).toBe('pdf-not-found')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('answers 422 no-email when the customer has no email address', async () => {
      getContact.mockResolvedValue({
        ok: true,
        data: individual({ emails: [] }),
      })

      const res = await send(miscellaneousInvoice.invoiceId)

      expect(res.status).toBe(422)
      expect(res.body.reason).toBe('no-email')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('does not email a protected identity the contacts service returned redacted', async () => {
      getContact.mockResolvedValue({
        ok: true,
        data: individual({
          protectedIdentity: true,
          fullName: 'redacted',
          emails: [{ emailAddress: 'redacted', isPrimary: true }],
        }),
      })

      const res = await send(miscellaneousInvoice.invoiceId)

      expect(res.status).toBe(422)
      expect(res.body.reason).toBe('no-recipient')
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('does not email when the contact lookup fails', async () => {
      getContact.mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await send(miscellaneousInvoice.invoiceId)

      expect(res.status).toBe(500)
      expect(res.body.reason).toBe('unknown')
      expect(sendEmail).not.toHaveBeenCalled()
    })
  })

  it('answers 404 pdf-not-found for a rent notice that is only in the ledger', async () => {
    notInRentSystem()
    jest
      .spyOn(economyAdapter, 'getInvoiceByInvoiceId')
      .mockResolvedValue({ ok: true, data: rentNotice })

    const res = await send(rentNotice.invoiceId)

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('pdf-not-found')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does not email a rent notice as a miscellaneous invoice when the caller gives the wrong type', async () => {
    notInRentSystem()
    jest
      .spyOn(economyAdapter, 'getInvoiceByInvoiceId')
      .mockResolvedValue({ ok: true, data: rentNotice })
    const getInvoiceFile = jest.spyOn(economyAdapter, 'getInvoiceFile')

    const res = await send(rentNotice.invoiceId, { invoiceType: 'Other' })

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('pdf-not-found')
    expect(getInvoiceFile).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('answers 400 for an invoice type that does not exist', async () => {
    const res = await send(rentNotice.invoiceId, { invoiceType: 'Rent' })

    expect(res.status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('answers 404 invoice-not-found for an unknown invoice', async () => {
    notInRentSystem()
    jest
      .spyOn(economyAdapter, 'getInvoiceByInvoiceId')
      .mockResolvedValue({ ok: false, err: 'not-found' })

    const res = await send('MISSING')

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('invoice-not-found')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
