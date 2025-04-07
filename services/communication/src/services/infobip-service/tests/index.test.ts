import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Email, WorkOrderSms } from 'onecore-types'

import { isMessageEmail, isValidWorkOrderSms } from '../index'
import * as infobipAdapter from '../adapters/infobip-adapter'
import { routes } from '../'

jest.mock('onecore-utilities', () => {
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
    sendWorkOrderSmsSpy = jest.spyOn(infobipAdapter, 'sendWorkOrderSms')
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
    sendWorkOrderEmailSpy = jest.spyOn(infobipAdapter, 'sendWorkOrderEmail')
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
