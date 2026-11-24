import { afterEach, describe, expect, it, vi } from 'vitest'

import * as baseApi from './baseApi'
import {
  economyService,
  SubmitMiscellaneousInvoiceError,
} from './economyService'

// The real baseApi reads the app environment at import, so it is replaced.
vi.mock('./baseApi', () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message)
    }
  },
}))

const respond = (status: number, rest: Record<string, unknown> = {}) =>
  ({ response: new Response(null, { status }), ...rest }) as never

describe('economyService.getInvoicePdf', () => {
  afterEach(() => vi.resetAllMocks())

  it('returns the PDF blob', async () => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    vi.mocked(baseApi.GET).mockResolvedValue(respond(200, { data: pdf }))

    await expect(economyService.getInvoicePdf('552000000001')).resolves.toBe(
      pdf
    )
    expect(baseApi.GET).toHaveBeenCalledWith('/invoices/{ocr}/pdf', {
      params: { path: { ocr: '552000000001' } },
      parseAs: 'blob',
    })
  })

  it('returns null when there is no rent notice PDF', async () => {
    vi.mocked(baseApi.GET).mockResolvedValue(respond(404))

    await expect(economyService.getInvoicePdf('552000000001')).resolves.toBe(
      null
    )
  })

  it('throws when the download fails', async () => {
    vi.mocked(baseApi.GET).mockResolvedValue(respond(500))

    await expect(
      economyService.getInvoicePdf('552000000001')
    ).rejects.toMatchObject({ status: 500 })
  })
})

describe('economyService.sendInvoiceToCustomer', () => {
  const rentNotice = {
    invoiceId: '552000000001',
    invoiceType: 'Regular',
    contactCode: 'P174691',
  } as const

  afterEach(() => vi.resetAllMocks())

  it('resolves when the invoice was sent', async () => {
    vi.mocked(baseApi.POST).mockResolvedValue(
      respond(200, { data: { content: { sent: true } } })
    )

    await expect(
      economyService.sendInvoiceToCustomer(rentNotice)
    ).resolves.toBeUndefined()
    expect(baseApi.POST).toHaveBeenCalledWith('/invoices/{invoiceId}/send', {
      params: { path: { invoiceId: '552000000001' } },
      body: { invoiceType: 'Regular', contactCode: 'P174691' },
    })
  })

  it('rejects with the reason core gave', async () => {
    vi.mocked(baseApi.POST).mockResolvedValue(
      respond(422, { error: { reason: 'no-email' } })
    )

    await expect(
      economyService.sendInvoiceToCustomer(rentNotice)
    ).rejects.toEqual({ reason: 'no-email' })
  })

  it('rejects with unknown when a failed response has no body', async () => {
    vi.mocked(baseApi.POST).mockResolvedValue(respond(502))

    await expect(
      economyService.sendInvoiceToCustomer(rentNotice)
    ).rejects.toEqual({ reason: 'unknown' })
  })
})

describe('economyService.submitMiscellaneousInvoice', () => {
  const invoice = {
    invoiceRows: [{ price: '100' }],
  } as unknown as Parameters<
    typeof economyService.submitMiscellaneousInvoice
  >[0]

  afterEach(() => vi.resetAllMocks())

  it('rejects with the status and code when the customer cannot be created', async () => {
    vi.mocked(baseApi.POST).mockResolvedValue(
      respond(502, { error: { type: 'customer-creation-failed' } })
    )

    const result = economyService.submitMiscellaneousInvoice(invoice)

    await expect(result).rejects.toBeInstanceOf(SubmitMiscellaneousInvoiceError)
    await expect(result).rejects.toMatchObject({
      status: 502,
      code: 'customer-creation-failed',
    })
  })

  it('rejects without a code when a failed response has no body', async () => {
    vi.mocked(baseApi.POST).mockResolvedValue(respond(500))

    await expect(
      economyService.submitMiscellaneousInvoice(invoice)
    ).rejects.toMatchObject({ status: 500, code: undefined })
  })

  it('rejects without a code when core returns an unrecognised type', async () => {
    vi.mocked(baseApi.POST).mockResolvedValue(
      respond(400, { error: { type: 'something-else' } })
    )

    await expect(
      economyService.submitMiscellaneousInvoice(invoice)
    ).rejects.toMatchObject({ status: 400, code: undefined })
  })

  it('returns the data on success', async () => {
    const data = { content: { ok: true } }
    vi.mocked(baseApi.POST).mockResolvedValue(respond(200, { data }))

    await expect(
      economyService.submitMiscellaneousInvoice(invoice)
    ).resolves.toBe(data)
  })
})
