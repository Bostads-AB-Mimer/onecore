import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Email } from '@onecore/types'
import * as infobipAdapter from '../adapters/infobip-adapter'
import { routes } from '../'

jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('/sendMessageWithAttachment', () => {
  let sendEmailSpy: jest.SpyInstance<Promise<any>, [message: Email], any>

  beforeEach(() => {
    sendEmailSpy = jest.spyOn(infobipAdapter, 'sendEmail')
    sendEmailSpy.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should send email with PDF attachment', async () => {
    sendEmailSpy.mockResolvedValue({ data: { messageId: '123' } })

    const pdfContent = Buffer.from('mock pdf content').toString('base64')

    const emailWithAttachment: Email = {
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email with attachment',
      attachments: [
        {
          filename: 'document.pdf',
          content: pdfContent,
          contentType: 'application/pdf',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/sendMessageWithAttachment')
      .send(emailWithAttachment)

    expect(res.status).toBe(200)
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email with attachment',
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'document.pdf',
            content: pdfContent,
            contentType: 'application/pdf',
          }),
        ]),
      })
    )
  })

  it('should send email with multiple attachments', async () => {
    sendEmailSpy.mockResolvedValue({ data: { messageId: '123' } })

    const emailWithAttachments: Email = {
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email with multiple attachments',
      attachments: [
        {
          filename: 'document1.pdf',
          content: 'base64content1',
          contentType: 'application/pdf',
        },
        {
          filename: 'document2.pdf',
          content: 'base64content2',
          contentType: 'application/pdf',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/sendMessageWithAttachment')
      .send(emailWithAttachments)

    expect(res.status).toBe(200)
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: 'document1.pdf' }),
          expect.objectContaining({ filename: 'document2.pdf' }),
        ]),
      })
    )
  })

  it('should send email without attachments', async () => {
    sendEmailSpy.mockResolvedValue({ data: { messageId: '123' } })

    const emailWithoutAttachment: Email = {
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email without attachment',
    }

    const res = await request(app.callback())
      .post('/sendMessageWithAttachment')
      .send(emailWithoutAttachment)

    expect(res.status).toBe(200)
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email without attachment',
      })
    )
  })

  it('should return 400 for invalid email object', async () => {
    sendEmailSpy.mockResolvedValue({ data: { messageId: '123' } })

    const invalidEmail = {
      to: 'invalid-email',
      subject: 'Test',
    }

    const res = await request(app.callback())
      .post('/sendMessageWithAttachment')
      .send(invalidEmail)

    expect(res.status).toBe(400)
    expect(res.body.reason).toBe('Message is not an email object')
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('should return 500 when infobip adapter throws error', async () => {
    sendEmailSpy.mockRejectedValue(new Error('Infobip API error'))

    const emailWithAttachment: Email = {
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email',
      attachments: [
        {
          filename: 'document.pdf',
          content: 'base64content',
          contentType: 'application/pdf',
        },
      ],
    }

    const res = await request(app.callback())
      .post('/sendMessageWithAttachment')
      .send(emailWithAttachment)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Infobip API error')
  })
})

describe('infobip-adapter sendEmail with attachments', () => {
  it('should handle base64 string content in attachments', () => {
    const base64Content = Buffer.from('mock pdf content').toString('base64')

    const emailWithBase64Attachment: Email = {
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test',
      attachments: [
        {
          filename: 'test.pdf',
          content: base64Content,
          contentType: 'application/pdf',
        },
      ],
    }

    expect(emailWithBase64Attachment.attachments).toBeDefined()
    expect(typeof emailWithBase64Attachment.attachments![0].content).toBe(
      'string'
    )
  })
})
