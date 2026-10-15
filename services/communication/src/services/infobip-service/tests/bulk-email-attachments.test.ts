import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { EMAIL_ATTACHMENT_MAX_TOTAL_BYTES } from '@onecore/types'

import * as emailAdapter from '../adapters/email-adapter'
import * as infobipAdapter from '../adapters/infobip-adapter'
import { routes } from '../'
import { logOutboundDispatch } from '../../communication-log-service/adapters/db'

jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      warn: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

jest.mock('../../communication-log-service/adapters/db', () => ({
  logOutboundDispatch: jest.fn().mockResolvedValue({ dispatchId: 'test-id' }),
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
// Matches the communication service's real limit so oversize attachments
// reach the route validation instead of being cut off by the body parser.
app.use(bodyParser({ jsonLimit: '50mb' }))
app.use(router.routes())

const pdf = {
  filename: 'hyresavtal.pdf',
  content: Buffer.from('mock pdf content').toString('base64'),
  contentType: 'application/pdf',
}

describe('/sendBulkEmail with attachments', () => {
  const logOutboundDispatchMock = logOutboundDispatch as jest.Mock
  let sendEmailWithAttachmentsSpy: jest.SpyInstance
  let sendBulkEmailSpy: jest.SpyInstance

  beforeEach(() => {
    logOutboundDispatchMock.mockReset()
    logOutboundDispatchMock.mockResolvedValue({ dispatchId: 'test-id' })
    sendEmailWithAttachmentsSpy = jest
      .spyOn(infobipAdapter, 'sendEmailWithAttachments')
      .mockImplementation(async ({ emails }) =>
        emails.map((emailAddress, i) => ({
          emailAddress,
          messageId: `mid-${i}`,
        }))
      )
    sendBulkEmailSpy = jest.spyOn(emailAdapter, 'sendBulkEmail')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('passes attachments to the attachment-capable adapter', async () => {
    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        recipients: [{ contactCode: 'P1', emailAddress: 'tenant@example.com' }],
        subject: 'Hej',
        text: 'Se bifogad fil',
        attachments: [pdf],
      })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      successful: ['tenant@example.com'],
      invalid: [],
      totalSent: 1,
      totalInvalid: 0,
    })
    expect(sendBulkEmailSpy).not.toHaveBeenCalled()
    expect(sendEmailWithAttachmentsSpy).toHaveBeenCalledWith({
      emails: ['tenant@example.com'],
      subject: 'Hej',
      text: 'Se bifogad fil',
      attachments: [pdf],
    })
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: [
          expect.objectContaining({
            contactCode: 'P1',
            toAddress: 'tenant@example.com',
            externalMessageId: 'mid-0',
          }),
        ],
      })
    )
  })

  it('reports recipients whose send failed and only logs the sent ones', async () => {
    sendEmailWithAttachmentsSpy.mockResolvedValue([
      { emailAddress: 'a@example.com', messageId: 'mid-a' },
      { emailAddress: 'b@example.com', error: '400' },
    ])

    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['a@example.com', 'b@example.com'],
        subject: 'Hej',
        text: 'Test',
        attachments: [pdf],
      })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      successful: ['a@example.com'],
      invalid: ['b@example.com'],
      totalSent: 1,
      totalInvalid: 1,
    })
    expect(res.body.warnings).toEqual([
      expect.stringContaining('Sending failed for 1'),
    ])
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: [expect.objectContaining({ toAddress: 'a@example.com' })],
      })
    )
  })

  it('returns 500 when no recipient could be sent to', async () => {
    sendEmailWithAttachmentsSpy.mockResolvedValue([
      { emailAddress: 'a@example.com', error: '500' },
    ])

    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['a@example.com'],
        subject: 'Hej',
        text: 'Test',
        attachments: [pdf],
      })

    expect(res.status).toBe(500)
    expect(logOutboundDispatchMock).not.toHaveBeenCalled()
  })

  it('uses the regular bulk send when there are no attachments', async () => {
    sendBulkEmailSpy.mockResolvedValue({ data: { messages: [] } })

    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['tenant@example.com'],
        subject: 'Hej',
        text: 'Test',
        attachments: [],
      })

    expect(res.status).toBe(200)
    expect(sendBulkEmailSpy).toHaveBeenCalled()
    expect(sendEmailWithAttachmentsSpy).not.toHaveBeenCalled()
  })

  it('returns 400 for a disallowed file type', async () => {
    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['tenant@example.com'],
        subject: 'Hej',
        text: 'Test',
        attachments: [
          {
            filename: 'virus.exe',
            content: pdf.content,
            contentType: 'application/x-msdownload',
          },
        ],
      })

    expect(res.status).toBe(400)
    expect(sendEmailWithAttachmentsSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when attachments exceed the total size limit', async () => {
    const tooLarge = Buffer.alloc(
      EMAIL_ATTACHMENT_MAX_TOTAL_BYTES + 1
    ).toString('base64')

    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['tenant@example.com'],
        subject: 'Hej',
        text: 'Test',
        attachments: [{ ...pdf, content: tooLarge }],
      })

    expect(res.status).toBe(400)
    expect(sendEmailWithAttachmentsSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when attachment content is not base64', async () => {
    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['tenant@example.com'],
        subject: 'Hej',
        text: 'Test',
        attachments: [{ ...pdf, content: 'not base64!' }],
      })

    expect(res.status).toBe(400)
    expect(sendEmailWithAttachmentsSpy).not.toHaveBeenCalled()
  })
})
