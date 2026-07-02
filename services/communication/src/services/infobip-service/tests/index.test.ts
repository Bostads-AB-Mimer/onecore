import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Email, WorkOrderSms, BulkSms } from '@onecore/types'

import { isMessageEmail, isValidWorkOrderSms, isValidBulkSms } from '../index'
import * as emailAdapter from '../adapters/email-adapter'
import * as smsAdapter from '../adapters/sms-adapter'
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

// Skip the real DB-backed logging adapter — these route tests assert HTTP
// behavior, not persistence. The dedicated db-adapter tests cover that path.
jest.mock('../../communication-log-service/adapters/db', () => ({
  logOutboundDispatch: jest.fn().mockResolvedValue({ dispatchId: 'test-id' }),
}))

// Builds a full Infobip v4 send response so spy return types match the adapter.
const emailSendResult = (messageId: string) => ({
  data: {
    messages: [
      {
        messageId,
        to: 'tenant@example.com',
        status: {
          groupId: 1,
          groupName: 'PENDING',
          id: 26,
          name: 'PENDING_ACCEPTED',
          description: 'Message accepted',
        },
      },
    ],
  },
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

describe('work order tenant message logging', () => {
  const logOutboundDispatchMock = logOutboundDispatch as jest.Mock

  // The SMS adapter returns the Infobip v3 response directly (no `.data`
  // wrapper, unlike the email adapter), so the route reads messages[0] off it.
  const smsSendResult = (messageId: string) => ({
    messages: [
      {
        to: '46701234567',
        messageId,
        status: {
          groupId: 1,
          groupName: 'PENDING',
          id: 26,
          name: 'PENDING_ACCEPTED',
          description: 'Message accepted',
        },
      },
    ],
  })

  beforeEach(() => {
    logOutboundDispatchMock.mockReset()
    logOutboundDispatchMock.mockResolvedValue({ dispatchId: 'test-id' })
  })

  it('logs the SMS with contactCode, messageId and the triggering user', async () => {
    jest
      .spyOn(smsAdapter, 'sendWorkOrderSms')
      .mockResolvedValue(smsSendResult('mid-wo-sms'))

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '0701234567',
      text: 'Ditt ärende är uppdaterat',
      contactCode: 'P123456',
      triggeredByUser: 'Anna Handläggare',
    })

    expect(res.status).toBe(200)
    expect(logOutboundDispatchMock).toHaveBeenCalledTimes(1)
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'sms',
        messageType: 'work_order_tenant_sms',
        triggeredByUser: 'Anna Handläggare',
        recipients: [
          expect.objectContaining({
            contactCode: 'P123456',
            toAddress: '46701234567',
            externalMessageId: 'mid-wo-sms',
            status: 'pending',
          }),
        ],
      })
    )
  })

  it('does not log the SMS when contactCode is absent (back-compat)', async () => {
    jest
      .spyOn(smsAdapter, 'sendWorkOrderSms')
      .mockResolvedValue(smsSendResult('mid-wo-sms'))

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '0701234567',
      text: 'hello',
    })

    expect(res.status).toBe(200)
    expect(logOutboundDispatchMock).not.toHaveBeenCalled()
  })

  it('surfaces a non-blocking warning when SMS logging throws', async () => {
    jest
      .spyOn(smsAdapter, 'sendWorkOrderSms')
      .mockResolvedValue(smsSendResult('mid-wo-sms'))
    logOutboundDispatchMock.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app.callback()).post('/sendWorkOrderSms').send({
      phoneNumber: '0701234567',
      text: 'hello',
      contactCode: 'P123456',
    })

    expect(res.status).toBe(200)
    expect(res.body.warnings).toEqual(['Communication log failed'])
  })

  it('logs the email with contactCode and messageId', async () => {
    jest
      .spyOn(emailAdapter, 'sendWorkOrderEmail')
      .mockResolvedValue(emailSendResult('mid-wo-mail'))

    const res = await request(app.callback()).post('/sendWorkOrderEmail').send({
      to: 'tenant@example.com',
      subject: 'Ditt ärende',
      text: 'Ditt ärende är uppdaterat',
      contactCode: 'P123456',
    })

    expect(res.status).toBe(200)
    expect(logOutboundDispatchMock).toHaveBeenCalledTimes(1)
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        messageType: 'work_order_tenant_mail',
        recipients: [
          expect.objectContaining({
            contactCode: 'P123456',
            toAddress: 'tenant@example.com',
            externalMessageId: 'mid-wo-mail',
            status: 'pending',
          }),
        ],
      })
    )
  })

  it('does not log the email when contactCode is absent (back-compat)', async () => {
    jest
      .spyOn(emailAdapter, 'sendWorkOrderEmail')
      .mockResolvedValue(emailSendResult('mid-wo-mail'))

    const res = await request(app.callback()).post('/sendWorkOrderEmail').send({
      to: 'tenant@example.com',
      subject: 'subject',
      text: 'hello',
    })

    expect(res.status).toBe(200)
    expect(logOutboundDispatchMock).not.toHaveBeenCalled()
  })

  it('surfaces a non-blocking warning when email logging throws', async () => {
    jest
      .spyOn(emailAdapter, 'sendWorkOrderEmail')
      .mockResolvedValue(emailSendResult('mid-wo-mail'))
    logOutboundDispatchMock.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app.callback()).post('/sendWorkOrderEmail').send({
      to: 'tenant@example.com',
      subject: 'subject',
      text: 'hello',
      contactCode: 'P123456',
    })

    expect(res.status).toBe(200)
    expect(res.body.warnings).toEqual(['Communication log failed'])
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
  let sendBulkSmsSpy: jest.SpyInstance<
    Promise<any>,
    [sms: { phoneNumbers: string[]; text: string }],
    any
  >

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

describe('parking space offer email logging', () => {
  const logOutboundDispatchMock = logOutboundDispatch as jest.Mock

  beforeEach(() => {
    logOutboundDispatchMock.mockReset()
    logOutboundDispatchMock.mockResolvedValue({ dispatchId: 'test-id' })
  })

  const offerBody = {
    to: 'tenant@example.com',
    contactCode: 'P123456',
    subject: 'Erbjudande om bilplats',
    text: 'Erbjudande om bilplats',
    address: 'Testgatan 1',
    firstName: 'Test',
    availableFrom: '2026-01-01',
    deadlineDate: '2026-01-05',
    rent: '500',
    type: 'Bilplats',
    parkingSpaceId: '123-456-789',
    objectId: '42',
    applicationType: 'Additional',
    offerURL: 'https://example.com/offer/42',
  }

  it('logs the offer email to the communication log with contactCode and messageId', async () => {
    jest
      .spyOn(emailAdapter, 'sendParkingSpaceOffer')
      .mockResolvedValue(emailSendResult('mid-offer'))

    const res = await request(app.callback())
      .post('/sendParkingSpaceOffer')
      .send(offerBody)

    expect(res.status).toBe(200)
    expect(logOutboundDispatchMock).toHaveBeenCalledTimes(1)
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        messageType: 'parking_space_offer',
        triggeredByUser: 'Automatiskt utskick',
        recipients: [
          expect.objectContaining({
            contactCode: 'P123456',
            toAddress: 'tenant@example.com',
            externalMessageId: 'mid-offer',
            status: 'pending',
          }),
        ],
      })
    )
  })

  it('does not fail the send when communication logging throws (strict but non-blocking)', async () => {
    jest
      .spyOn(emailAdapter, 'sendParkingSpaceOffer')
      .mockResolvedValue(emailSendResult('mid-offer'))
    logOutboundDispatchMock.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app.callback())
      .post('/sendParkingSpaceOffer')
      .send(offerBody)

    expect(res.status).toBe(200)
  })

  it('logs the accept-offer email with the right messageType', async () => {
    jest
      .spyOn(emailAdapter, 'sendParkingSpaceAcceptOffer')
      .mockResolvedValue(emailSendResult('mid-accept'))

    const res = await request(app.callback())
      .post('/sendParkingSpaceAcceptOffer')
      .send({
        to: 'tenant@example.com',
        contactCode: 'P123456',
        subject: 'Du har tackat ja till en bilplats',
        text: 'Du har tackat ja till en bilplats hos Bostads Mimer.',
        firstName: 'Test',
        parkingSpaceId: '123-456-789',
        address: 'Testgatan 1',
        availableFrom: '2026-01-01',
        rent: '500',
        type: 'Bilplats',
        objectId: '42',
      })

    expect(res.status).toBe(204)
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'parking_space_accept_offer',
        recipients: [
          expect.objectContaining({ externalMessageId: 'mid-accept' }),
        ],
      })
    )
  })

  it('logs the non-scored approved email with the right messageType', async () => {
    jest
      .spyOn(emailAdapter, 'sendNonScoredParkingSpaceApproved')
      .mockResolvedValue(emailSendResult('mid-appr'))

    const res = await request(app.callback())
      .post('/sendNonScoredParkingSpaceApproved')
      .send({
        to: 'tenant@example.com',
        contactCode: 'P123456',
        subject: 'Godkänd ansökan om bilplats',
        text: 'Din ansökan om bilplats har godkänts.',
        leaseId: 'L-1',
        address: 'Testgatan 1',
        availableFrom: '2026-01-01',
        parkingSpaceId: '123-456-789',
        objectId: '42',
        type: 'Bilplats',
        rent: '500',
      })

    expect(res.status).toBe(204)
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'non_scored_parking_space_approved',
      })
    )
  })

  it('logs the non-scored denied email with the right messageType', async () => {
    jest
      .spyOn(emailAdapter, 'sendNonScoredParkingSpaceDenied')
      .mockResolvedValue(emailSendResult('mid-deny'))

    const res = await request(app.callback())
      .post('/sendNonScoredParkingSpaceDenied')
      .send({
        to: 'tenant@example.com',
        contactCode: 'P123456',
        subject: 'Nekad ansökan om bilplats',
        text: 'Din ansökan om bilplats kunde inte godkännas.',
        address: 'Testgatan 1',
        availableFrom: '2026-01-01',
        parkingSpaceId: '123-456-789',
        objectId: '42',
        type: 'Bilplats',
        rent: '500',
      })

    expect(res.status).toBe(204)
    expect(logOutboundDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'non_scored_parking_space_denied',
      })
    )
  })
})

describe('/sendBulkEmail logging', () => {
  const logOutboundDispatchMock = logOutboundDispatch as jest.Mock

  beforeEach(() => {
    logOutboundDispatchMock.mockReset()
    logOutboundDispatchMock.mockResolvedValue({ dispatchId: 'test-id' })
    jest
      .spyOn(emailAdapter, 'sendBulkEmail')
      .mockResolvedValue(emailSendResult('mid-bulk'))
  })

  it('returns 200 with no warnings when logging succeeds', async () => {
    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['tenant@example.com'],
        subject: 'Hej',
        text: 'Test',
      })

    expect(res.status).toBe(200)
    expect(res.body.warnings).toBeUndefined()
  })

  it('returns 200 with a warning (non-blocking) when logging fails', async () => {
    logOutboundDispatchMock.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app.callback())
      .post('/sendBulkEmail')
      .send({
        emails: ['tenant@example.com'],
        subject: 'Hej',
        text: 'Test',
      })

    expect(res.status).toBe(200)
    expect(res.body.warnings).toEqual([
      expect.stringContaining('Communication log failed'),
    ])
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
