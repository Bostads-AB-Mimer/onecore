import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Email, WorkOrderSms, BulkSms } from '@onecore/types'

import { isMessageEmail, isValidWorkOrderSms, isValidBulkSms } from '../index'
import * as emailAdapter from '../adapters/email-adapter'
import * as smsAdapter from '../adapters/sms-adapter'
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

describe('/sendWorkOrderSms', () => {
  let sendWorkOrderSmsSpy: jest.SpyInstance<
    Promise<any>,
    [sms: WorkOrderSms],
    any
  >

  beforeEach(() => {
    sendWorkOrderSmsSpy = jest.spyOn(smsAdapter, 'sendWorkOrderSms')
    sendWorkOrderSmsSpy.mockReset()
  })

  it('should return 200', async () => {
    sendWorkOrderSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '0701234567',
      text: 'hello',
    })

    expect(res.status).toBe(200)
    expect(sendWorkOrderSmsSpy).toHaveBeenCalledWith({
      phoneNumber: '46701234567',
      text: 'hello',
    })
  })

  it('should return 400 for invalid request body', async () => {
    sendWorkOrderSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '0701234567',
    })

    expect(res.status).toBe(400)
    expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid phone number', async () => {
    sendWorkOrderSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '123',
      message: 'hello',
    })

    expect(res.status).toBe(400)
    expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()
  })

  it('should return 400 if phone number is not a mobile number', async () => {
    sendWorkOrderSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '016114164',
      message: 'hello',
    })

    expect(res.status).toBe(400)
    expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()
  })
})

describe('/sendWorkOrderEmail', () => {
  let sendWorkOrderEmailSpy: jest.SpyInstance<
    Promise<any>,
    [message: Email],
    any
  >

  beforeEach(() => {
    sendWorkOrderEmailSpy = jest.spyOn(emailAdapter, 'sendWorkOrderEmail')
    sendWorkOrderEmailSpy.mockReset()
  })

  it('should return 200', async () => {
    sendWorkOrderEmailSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderEmail').send({
      to: 'hello@example.com',
      subject: 'subject',
      text: 'hello',
    })

    expect(res.status).toBe(200)
    expect(sendWorkOrderEmailSpy).toHaveBeenCalledWith({
      to: 'hello@example.com',
      subject: 'subject',
      text: 'hello',
    })
  })

  it('should return 400 for invalid request body', async () => {
    sendWorkOrderEmailSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderEmail').send({
      text: 'hello',
    })

    expect(res.status).toBe(400)
    expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid email', async () => {
    sendWorkOrderEmailSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendWorkOrderEmail').send({
      to: 'hello',
      subject: 'subject',
      text: 'hello',
    })

    expect(res.status).toBe(400)
    expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()
  })
})

describe('isMessageEmail', () => {
  it('should return true for valid email objects', () => {
    const validEmail = {
      to: 'test@example.com',
      subject: 'subject',
      text: 'text',
    }

    expect(isMessageEmail(validEmail)).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    const invalidEmailAddress = {
      to: 'invalid email',
      subject: 'subject',
      text: 'text',
    }

    expect(isMessageEmail(invalidEmailAddress)).toBe(false)
  })

  it('should return false for objects missing required properties', () => {
    const missingProperties = {
      to: 'test@example.com',
      subject: 'subject',
    }

    expect(isMessageEmail(missingProperties)).toBe(false)
  })

  it('should return false for objects with incorrect property types', () => {
    const incorrectTypes = {
      to: 'test@example.com',
      subject: 123,
      text: 'text',
    }

    expect(isMessageEmail(incorrectTypes)).toBe(false)
  })

  it('should return false for non-object inputs', () => {
    expect(isMessageEmail('not an object')).toBe(false)
  })
})

describe('isValidWorkOrderSms', () => {
  it('should return true for valid WorkOrderSms objects', () => {
    const validSms = {
      phoneNumber: '1234567890',
      text: 'hello',
    }

    expect(isValidWorkOrderSms(validSms)).toBe(true)
  })

  it('should return false for missing phone number', () => {
    const invalidSms = {
      message: 'hello',
    }

    expect(isValidWorkOrderSms(invalidSms)).toBe(false)
  })

  it('should return false for missing message', () => {
    const invalidSms = {
      phoneNumber: '1234567890',
    }

    expect(isValidWorkOrderSms(invalidSms)).toBe(false)
  })

  it('should return false for non-object inputs', () => {
    expect(isValidWorkOrderSms('not an object')).toBe(false)
  })
})

describe('/sendBulkSms', () => {
  let sendBulkSmsSpy: jest.SpyInstance<Promise<any>, [sms: BulkSms], any>

  beforeEach(() => {
    sendBulkSmsSpy = jest.spyOn(smsAdapter, 'sendBulkSms')
    sendBulkSmsSpy.mockReset()
  })

  it('should return 200 with all valid phone numbers', async () => {
    sendBulkSmsSpy.mockResolvedValue({})

    const res = await request(app.callback())
      .post('/sendBulkSms')
      .send({
        phoneNumbers: ['0701234567', '0709876543'],
        text: 'Test message',
      })

    expect(res.status).toBe(200)
    expect(sendBulkSmsSpy).toHaveBeenCalledWith({
      phoneNumbers: ['46701234567', '46709876543'],
      text: 'Test message',
    })
    expect(res.body.content.successful).toHaveLength(2)
    expect(res.body.content.invalid).toHaveLength(0)
  })

  it('should return 200 with partial valid phone numbers', async () => {
    sendBulkSmsSpy.mockResolvedValue({})

    const res = await request(app.callback())
      .post('/sendBulkSms')
      .send({
        phoneNumbers: ['0701234567', 'invalid', '0709876543'],
        text: 'Test message',
      })

    expect(res.status).toBe(200)
    expect(sendBulkSmsSpy).toHaveBeenCalledWith({
      phoneNumbers: ['46701234567', '46709876543'],
      text: 'Test message',
    })
    expect(res.body.content.successful).toHaveLength(2)
    expect(res.body.content.invalid).toEqual(['invalid'])
  })

  it('should return 400 for missing text', async () => {
    const res = await request(app.callback())
      .post('/sendBulkSms')
      .send({
        phoneNumbers: ['0701234567'],
      })

    expect(res.status).toBe(400)
    expect(sendBulkSmsSpy).not.toHaveBeenCalled()
  })

  it('should return 400 for empty phoneNumbers array', async () => {
    const res = await request(app.callback()).post('/sendBulkSms').send({
      phoneNumbers: [],
      text: 'Test message',
    })

    expect(res.status).toBe(400)
    expect(sendBulkSmsSpy).not.toHaveBeenCalled()
  })

  it('should return 400 when all phone numbers are invalid', async () => {
    const res = await request(app.callback())
      .post('/sendBulkSms')
      .send({
        phoneNumbers: ['invalid1', 'invalid2'],
        text: 'Test message',
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toBe('No valid phone numbers')
    expect(sendBulkSmsSpy).not.toHaveBeenCalled()
  })
})

describe('isValidBulkSms', () => {
  it('should return true for valid BulkSms objects', () => {
    const validSms = {
      phoneNumbers: ['0701234567', '0709876543'],
      text: 'Hello, this is a test message',
    }

    expect(isValidBulkSms(validSms)).toBe(true)
  })

  it('should return false for missing phoneNumbers', () => {
    const invalidSms = { text: 'hello' }

    expect(isValidBulkSms(invalidSms)).toBe(false)
  })

  it('should return false for missing text', () => {
    const invalidSms = { phoneNumbers: ['0701234567'] }

    expect(isValidBulkSms(invalidSms)).toBe(false)
  })

  it('should return false for empty phoneNumbers array', () => {
    const invalidSms = { phoneNumbers: [], text: 'hello' }

    expect(isValidBulkSms(invalidSms)).toBe(false)
  })

  it('should return false for empty text', () => {
    const invalidSms = { phoneNumbers: ['0701234567'], text: '' }

    expect(isValidBulkSms(invalidSms)).toBe(false)
  })

  it('should return false for non-object inputs', () => {
    expect(isValidBulkSms('not an object')).toBe(false)
    expect(isValidBulkSms(null)).toBe(false)
  })
})
