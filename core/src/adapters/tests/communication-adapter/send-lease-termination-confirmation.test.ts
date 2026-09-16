import axios from 'axios'
jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  loggedAxios: axios,
  axiosTypes: axios,
}))

import nock from 'nock'

import config from '../../../common/config'
import { sendLeaseTerminationConfirmationEmail } from '../../communication-adapter'

const email = {
  type: 'lease-termination-confirmation' as const,
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  address: 'Testgatan 1',
  leaseId: '307-002-11-0201/11',
  endDate: new Date('2026-10-31'),
  objectId: '123-456',
  rentalType: 'Bilplats' as const,
  parkingSpaceId: '123-456-789',
}

afterEach(() => {
  nock.cleanAll()
  jest.restoreAllMocks()
})

describe('sendLeaseTerminationConfirmationEmail', () => {
  it('returns ok:true when communication service responds 204', async () => {
    nock(config.communicationService.url)
      .post('/sendLeaseTerminationConfirmation', (body) => {
        expect(body).toMatchObject({
          type: 'lease-termination-confirmation',
          contactCode: 'P123456',
          leaseId: '307-002-11-0201/11',
          endDate: '2026-10-31',
        })
        return true
      })
      .reply(204)

    const result = await sendLeaseTerminationConfirmationEmail({ ...email })

    expect(result).toEqual({ ok: true, data: null })
  })

  it('redirects tenant email to tenantDefault outside production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'

    nock(config.communicationService.url)
      .post('/sendLeaseTerminationConfirmation', (body) => {
        expect(body.to).toBe(config.emailAddresses.tenantDefault)
        return true
      })
      .reply(204)

    await sendLeaseTerminationConfirmationEmail({ ...email })

    process.env.NODE_ENV = originalEnv
  })

  it('returns ok:false when communication service responds non-204', async () => {
    nock(config.communicationService.url)
      .post('/sendLeaseTerminationConfirmation')
      .reply(500, { error: 'Infobip down' })

    const result = await sendLeaseTerminationConfirmationEmail({ ...email })

    expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
  })

  it('returns ok:false when the HTTP call fails', async () => {
    nock(config.communicationService.url)
      .post('/sendLeaseTerminationConfirmation')
      .replyWithError('network error')

    const result = await sendLeaseTerminationConfirmationEmail({ ...email })

    expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
  })
})
