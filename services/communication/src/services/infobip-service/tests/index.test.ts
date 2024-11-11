import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { TicketMessageSms } from 'onecore-types'

import { isMessageEmail, isValidTicketMessageSms } from '../index'
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

describe('/sendTicketSms', () => {
  let sendTicketSmsSpy: jest.SpyInstance<
    Promise<any>,
    [sms: TicketMessageSms],
    any
  >

  beforeEach(() => {
    sendTicketSmsSpy = jest.spyOn(infobipAdapter, 'sendTicketSms')
    sendTicketSmsSpy.mockReset()
  })

  it('should return 200', async () => {
    sendTicketSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendTicketSms').send({
      phoneNumber: '0701234567',
      message: 'hello',
    })

    expect(res.status).toBe(200)
    expect(sendTicketSmsSpy).toHaveBeenCalledWith({
      phoneNumber: '46701234567',
      message: 'hello',
    })
  })

  it('should return 400 for invalid request body', async () => {
    sendTicketSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendTicketSms').send({
      phoneNumber: '0701234567',
    })

    expect(res.status).toBe(400)
    expect(sendTicketSmsSpy).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid phone number', async () => {
    sendTicketSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendTicketSms').send({
      phoneNumber: '123',
      message: 'hello',
    })

    expect(res.status).toBe(400)
    expect(sendTicketSmsSpy).not.toHaveBeenCalled()
  })

  it('should return 400 if phone number is not a mobile number', async () => {
    sendTicketSmsSpy.mockResolvedValue({})

    const res = await request(app.callback()).post('/sendTicketSms').send({
      phoneNumber: '016114164',
      message: 'hello',
    })

    expect(res.status).toBe(400)
    expect(sendTicketSmsSpy).not.toHaveBeenCalled()
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

describe('isValidTicketMessageSms', () => {
  it('should return true for valid TicketMessageSms objects', () => {
    const validSms = {
      phoneNumber: '1234567890',
      message: 'hello',
    }

    expect(isValidTicketMessageSms(validSms)).toBe(true)
  })

  it('should return false for missing phone number', () => {
    const invalidSms = {
      message: 'hello',
    }

    expect(isValidTicketMessageSms(invalidSms)).toBe(false)
  })

  it('should return false for missing message', () => {
    const invalidSms = {
      phoneNumber: '1234567890',
    }

    expect(isValidTicketMessageSms(invalidSms)).toBe(false)
  })

  it('should return false for non-object inputs', () => {
    expect(isValidTicketMessageSms('not an object')).toBe(false)
  })
})
