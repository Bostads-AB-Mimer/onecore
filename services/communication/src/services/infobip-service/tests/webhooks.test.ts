import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { routes } from '../routes/webhooks'
import { updateRecipientStatusByExternalId } from '../../communication-log-service/adapters/db'

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
  generateRouteMetadata: jest.fn(() => ({})),
}))

// Configure both auth mechanisms so each path is enforced in tests:
// Basic (email/subscription) and token (SMS/per-message webhook).
jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: {
    infobip: {
      webhookUsername: 'hook-user',
      webhookPassword: 'hook-pass',
      webhookToken: 'sms-token',
    },
  },
}))

jest.mock('../../communication-log-service/adapters/db', () => ({
  updateRecipientStatusByExternalId: jest
    .fn()
    .mockResolvedValue({ updatedCount: 1 }),
}))

const updateMock = updateRecipientStatusByExternalId as jest.Mock

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const post = () =>
  request(app.callback())
    .post('/webhooks/infobip')
    .auth('hook-user', 'hook-pass')

const deliveredReport = {
  results: [
    {
      messageId: '4823051030417951492201',
      status: {
        groupId: 3,
        groupName: 'DELIVERED',
        name: 'DELIVERED_TO_HANDSET',
      },
      error: { groupId: 0, groupName: 'OK', id: 0, name: 'NO_ERROR' },
    },
  ],
}

const failedReport = {
  results: [
    {
      messageId: '4823051025717950452410',
      status: {
        groupId: 2,
        groupName: 'UNDELIVERABLE',
        name: 'UNDELIVERABLE_NOT_DELIVERED',
      },
      error: {
        id: 1,
        name: 'EC_UNKNOWN_SUBSCRIBER',
        description: 'Unknown Subscriber',
      },
    },
  ],
}

beforeEach(() => {
  updateMock.mockClear()
  updateMock.mockResolvedValue({ updatedCount: 1 })
})

describe('POST /webhooks/infobip', () => {
  it('flips a row to delivered (no error persisted)', async () => {
    const res = await post().send(deliveredReport)

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      '4823051030417951492201',
      'delivered',
      undefined
    )
  })

  it('writes the provider error on a failed report', async () => {
    const res = await post().send(failedReport)

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      '4823051025717950452410',
      'failed',
      'Unknown Subscriber'
    )
  })

  it('flips a row to bounced and persists the bounce error', async () => {
    const res = await post().send({
      results: [
        {
          messageId: 'email-bounce-1',
          status: {
            groupName: 'UNDELIVERABLE',
            name: 'UNDELIVERABLE_REJECTED_OPERATOR',
          },
          error: {
            id: 6034,
            groupName: 'USER_ERRORS',
            description: 'Recipient address suppressed due to bounce',
            permanent: true,
          },
        },
      ],
    })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      'email-bounce-1',
      'bounced',
      'Recipient address suppressed due to bounce'
    )
  })

  it('processes every result in a batch and skips PENDING', async () => {
    const res = await post().send({
      results: [
        { messageId: 'batch-delivered', status: { groupName: 'DELIVERED' } },
        {
          messageId: 'batch-pending',
          status: { groupName: 'PENDING', name: 'PENDING_ENROUTE' },
        },
      ],
    })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith(
      'batch-delivered',
      'delivered',
      undefined
    )
  })

  it('acknowledges with 200 even when no row matches', async () => {
    updateMock.mockResolvedValue({ updatedCount: 0 })

    const res = await post().send({
      results: [
        {
          messageId: 'unknown-id',
          status: { groupName: 'DELIVERED' },
        },
      ],
    })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      'unknown-id',
      'delivered',
      undefined
    )
  })

  it('skips the db update for a non-terminal PENDING report', async () => {
    const res = await post().send({
      results: [
        {
          messageId: 'pending-id',
          status: { groupName: 'PENDING', name: 'PENDING_ENROUTE' },
        },
      ],
    })

    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a request with missing auth (401, no db call)', async () => {
    const res = await request(app.callback())
      .post('/webhooks/infobip')
      .send(deliveredReport)

    expect(res.status).toBe(401)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a request with wrong credentials (401, no db call)', async () => {
    const res = await request(app.callback())
      .post('/webhooks/infobip')
      .auth('hook-user', 'wrong-pass')
      .send(deliveredReport)

    expect(res.status).toBe(401)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed payload with 400', async () => {
    const res = await post().send({ notResults: [] })

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('POST /webhooks/infobip — token auth (SMS path)', () => {
  it('accepts a valid ?token= (no Basic header)', async () => {
    const res = await request(app.callback())
      .post('/webhooks/infobip?token=sms-token')
      .send(deliveredReport)

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      '4823051030417951492201',
      'delivered',
      undefined
    )
  })

  it('rejects a wrong ?token= with 401 (no db call)', async () => {
    const res = await request(app.callback())
      .post('/webhooks/infobip?token=wrong-token')
      .send(deliveredReport)

    expect(res.status).toBe(401)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
