jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

jest.mock('../../../common/config', () => {
  const actual = jest.requireActual('../../../common/config').default
  return {
    __esModule: true,
    default: {
      ...actual,
      infobip: { baseUrl: 'https://infobip.test/', apiKey: 'test-api-key' },
    },
  }
})

jest.mock('../../template-service/adapters/db', () => ({
  getSystemTemplate: jest.fn(),
}))

import { getSystemTemplate } from '../../template-service/adapters/db'
import {
  InvalidPlaceholderValueError,
  MissingPlaceholderError,
} from '../../template-service/render/render'
import { SystemTemplateNotFoundError } from '../../template-service/system-templates'
import {
  buildWorkOrderPlaceholders,
  sendInvoiceNotificationEmail,
  sendWorkOrderEmail,
} from '../adapters/email-adapter'
import { ProviderResponseError } from '../adapters/provider-error'

const getSystemTemplateMock = getSystemTemplate as jest.Mock
const fetchMock = jest.fn()

const workOrder = {
  to: 'tenant@example.com',
  subject: 'Ditt ärende',
  text: 'Hej!\nVi kommer på torsdag.',
}

const invoice = {
  to: 'tenant@example.com',
  firstName: 'Åsa',
  address: 'Bilvägen 3',
  invoiceNumber: '55012345',
  dueDate: '2026-12-31',
  totalAmount: '450',
}

const okResponse = {
  ok: true,
  json: async () => ({ messages: [{ messageId: 'mid-1' }] }),
}

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock
  getSystemTemplateMock.mockReset()
})

describe('rendered system emails', () => {
  it('sends rendered content as Bostads AB Mimer, without template ids', async () => {
    getSystemTemplateMock.mockResolvedValue({
      systemKey: 'work_order',
      subject: 'Meddelande',
      body: '{{message}}',
    })
    fetchMock.mockResolvedValue(okResponse)

    const result = await sendWorkOrderEmail(workOrder)

    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('https://infobip.test/email/4/messages')
    const message = JSON.parse(options.body).messages[0]
    expect(message.sender).toBe('Bostads AB Mimer <noreply@mimer.nu>')
    expect(Object.keys(message.content)).toEqual(['subject', 'html', 'text'])
    expect(message.content.subject).toBe('Meddelande')
    expect(message.content.html).toContain('Hej!<br />Vi kommer på torsdag.')
    expect(message.content.text).toContain('Hej!\nVi kommer på torsdag.')
    expect(message.destinations[0].to[0].placeholders).toBeUndefined()
    expect(result.rendered.subject).toBe('Meddelande')
    expect(result.response.messages?.[0].messageId).toBe('mid-1')
  })

  it('passes the Odoo HTML message through sanitized, inside our layout', async () => {
    getSystemTemplateMock.mockResolvedValue({
      systemKey: 'work_order',
      subject: 'Meddelande',
      body: '{{message}}\n\nMed vänlig hälsning',
    })
    fetchMock.mockResolvedValue(okResponse)

    const result = await sendWorkOrderEmail({
      ...workOrder,
      text:
        '<p>Hej!<br>Vi &amp; <strong>ni</strong> ses.</p><p>Mvh</p>' +
        '<img src="https://track.example/p.gif">',
    })

    expect(result.rendered.html).toContain(
      'Hej!<br />Vi &amp; <strong>ni</strong> ses.</p>'
    )
    expect(result.rendered.html).not.toMatch(/<p[^>]*>\s*<p/)
    expect(result.rendered.html).not.toContain('track.example')
    expect(result.rendered.text).toMatch(
      /^Hej!\nVi & ni ses\.\n\nMvh\n\nMed vänlig hälsning/
    )
  })

  it('accepts a plain-text message too', () => {
    const message = buildWorkOrderPlaceholders(workOrder).message
    expect(typeof message === 'string' ? message : message.text).toBe(
      'Hej!\nVi kommer på torsdag.'
    )
  })

  it('picks the external contractor template when a contractor is named', async () => {
    getSystemTemplateMock.mockResolvedValue({
      systemKey: 'work_order_external_contractor',
      subject: 'Meddelande',
      body: '{{message}} {{externalContractor}}',
    })
    fetchMock.mockResolvedValue(okResponse)

    await sendWorkOrderEmail({
      ...workOrder,
      externalContractorName: 'Vent AB',
    })

    expect(getSystemTemplateMock).toHaveBeenCalledWith(
      'work_order_external_contractor'
    )
  })

  it('sends nothing when the template uses a token the send does not supply', async () => {
    getSystemTemplateMock.mockResolvedValue({
      systemKey: 'work_order',
      subject: 'Meddelande',
      body: '{{message}} {{unknownToken}}',
    })

    await expect(sendWorkOrderEmail(workOrder)).rejects.toBeInstanceOf(
      MissingPlaceholderError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a value that cannot be formatted as invalid, and sends nothing', async () => {
    let thrown: unknown
    try {
      await sendInvoiceNotificationEmail({ ...invoice, dueDate: 'garbage' })
    } catch (err: unknown) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(InvalidPlaceholderValueError)
    expect(thrown).toMatchObject({ code: 'INVALID_PLACEHOLDER_VALUE' })
    expect(getSystemTemplateMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing when the system template is missing', async () => {
    getSystemTemplateMock.mockRejectedValue(
      new SystemTemplateNotFoundError('work_order')
    )

    await expect(sendWorkOrderEmail(workOrder)).rejects.toBeInstanceOf(
      SystemTemplateNotFoundError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('emails with attachments', () => {
  const withPdf = {
    ...invoice,
    attachments: [
      {
        filename: 'faktura.pdf',
        content: Buffer.from('pdf').toString('base64'),
        contentType: 'application/pdf',
      },
    ],
  }

  beforeEach(() => {
    getSystemTemplateMock.mockResolvedValue({
      systemKey: 'invoice_notification',
      subject: 'Faktura {{invoiceNumber}}',
      body: 'Hej {{firstName}}!',
    })
  })

  it('posts rendered subject, html and text as multipart fields', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    await sendInvoiceNotificationEmail(withPdf)

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { body: Uint8Array; headers: Record<string, string> },
    ]
    expect(url).toBe('https://infobip.test/email/3/send')
    // A random boundary: a value can't guess it to open a new form part.
    expect(options.headers['Content-Type']).toMatch(
      /boundary=----InfobipBoundary[0-9a-f-]{36}$/
    )
    const body = new TextDecoder().decode(options.body)
    expect(body).toContain(
      'name="from"\r\n\r\nBostads AB Mimer <noreply@mimer.nu>'
    )
    expect(body).toContain('name="subject"\r\n\r\nFaktura 55012345')
    expect(body).toMatch(/name="html"\r\n\r\n<!DOCTYPE html>/)
    expect(body).toContain('name="text"\r\n\r\nHej Åsa!')
    expect(body).not.toContain('name="templateId"')
    expect(body).toContain('filename="faktura.pdf"')
  })

  it('throws a ProviderResponseError when Infobip rejects it', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    })

    await expect(sendInvoiceNotificationEmail(withPdf)).rejects.toBeInstanceOf(
      ProviderResponseError
    )
  })
})
