import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import {
  cancelScheduledRecipients,
  getDispatchById,
  updateDispatchSendAt,
} from '../adapters/db'
import {
  cancelScheduledBulk,
  rescheduleScheduledBulk,
  ScheduledBulkConflictError,
} from '../../infobip-service/adapters/schedule-adapter'

jest.mock('@onecore/utilities', () => ({
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
}))

jest.mock('../adapters/db', () => ({
  getDispatchById: jest.fn(),
  cancelScheduledRecipients: jest.fn(),
  updateDispatchSendAt: jest.fn(),
  getCustomerMessages: jest.fn(),
  logOutboundDispatch: jest.fn(),
}))

// Keep the real error class so the routes' instanceof check works.
jest.mock('../../infobip-service/adapters/schedule-adapter', () => ({
  ...jest.requireActual('../../infobip-service/adapters/schedule-adapter'),
  cancelScheduledBulk: jest.fn(),
  rescheduleScheduledBulk: jest.fn(),
}))

const getDispatchByIdMock = getDispatchById as jest.Mock
const cancelScheduledRecipientsMock = cancelScheduledRecipients as jest.Mock
const updateDispatchSendAtMock = updateDispatchSendAt as jest.Mock
const cancelScheduledBulkMock = cancelScheduledBulk as jest.Mock
const rescheduleScheduledBulkMock = rescheduleScheduledBulk as jest.Mock

const app = new Koa()
const okapi = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(okapi)
app.use(bodyParser())
app.use(okapi.routes())

const DISPATCH_ID = '5a748f19-fca0-4562-9f8d-05eb0e16d076'

// Only the fields the routes actually read. Default sendAt is 30 minutes out
// so reschedule targets a day or more ahead count as "later".
const dispatchWithStatuses = (
  channel: 'sms' | 'email',
  statuses: string[],
  sendAt: string | Date = new Date(Date.now() + 30 * 60 * 1000)
) => ({
  dispatch: { id: DISPATCH_ID, channel, sendAt },
  recipients: statuses.map((status, i) => ({ id: `r${i}`, status })),
})

beforeEach(() => {
  getDispatchByIdMock.mockReset()
  cancelScheduledRecipientsMock.mockReset()
  updateDispatchSendAtMock.mockReset()
  cancelScheduledBulkMock.mockReset()
  rescheduleScheduledBulkMock.mockReset()
  cancelScheduledBulkMock.mockResolvedValue(undefined)
  rescheduleScheduledBulkMock.mockResolvedValue(undefined)
  cancelScheduledRecipientsMock.mockResolvedValue({ updatedCount: 2 })
  updateDispatchSendAtMock.mockResolvedValue({ updatedCount: 1 })
})

describe('POST /communication-log/dispatches/:id/cancel', () => {
  const cancel = () =>
    request(app.callback()).post(
      `/communication-log/dispatches/${DISPATCH_ID}/cancel`
    )

  it('returns 404 for an unknown dispatch', async () => {
    getDispatchByIdMock.mockResolvedValue(null)

    const res = await cancel()

    expect(res.status).toBe(404)
    expect(cancelScheduledBulkMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the dispatch is not scheduled', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['delivered', 'failed'])
    )

    const res = await cancel()

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NOT_SCHEDULED')
    expect(cancelScheduledBulkMock).not.toHaveBeenCalled()
  })

  it('is idempotent: an already-cancelled dispatch returns 200 without calling Infobip', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['cancelled', 'cancelled'])
    )

    const res = await cancel()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      cancelledRecipients: 0,
    })
    expect(cancelScheduledBulkMock).not.toHaveBeenCalled()
    expect(cancelScheduledRecipientsMock).not.toHaveBeenCalled()
  })

  it('cancels at Infobip first, then marks recipients cancelled', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled', 'scheduled'])
    )

    const res = await cancel()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      cancelledRecipients: 2,
    })
    expect(cancelScheduledBulkMock).toHaveBeenCalledWith('sms', DISPATCH_ID)
    expect(cancelScheduledRecipientsMock).toHaveBeenCalledWith(DISPATCH_ID)
  })

  it('retries the recipient update after a transient DB failure', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled', 'scheduled'])
    )
    cancelScheduledRecipientsMock
      .mockRejectedValueOnce(new Error('deadlock'))
      .mockResolvedValueOnce({ updatedCount: 2 })

    const res = await cancel()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      cancelledRecipients: 2,
    })
    expect(cancelScheduledRecipientsMock).toHaveBeenCalledTimes(2)
  })

  it('returns CANCEL_STATUS_UPDATE_FAILED when the DB update keeps failing after the Infobip cancel', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    cancelScheduledRecipientsMock.mockRejectedValue(new Error('db down'))

    const res = await cancel()

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('CANCEL_STATUS_UPDATE_FAILED')
    expect(cancelScheduledRecipientsMock).toHaveBeenCalledTimes(2)
  })

  it('uses the dispatch channel to pick the Infobip API (email)', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('email', ['scheduled'])
    )

    await cancel()

    expect(cancelScheduledBulkMock).toHaveBeenCalledWith('email', DISPATCH_ID)
  })

  it('returns 409 and leaves statuses untouched when Infobip refuses', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    cancelScheduledBulkMock.mockRejectedValue(
      new ScheduledBulkConflictError(400, 'bulk already processed')
    )

    const res = await cancel()

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
    expect(cancelScheduledRecipientsMock).not.toHaveBeenCalled()
  })
})

describe('POST /communication-log/dispatches/:id/reschedule', () => {
  const reschedule = (sendAt: string) =>
    request(app.callback())
      .post(`/communication-log/dispatches/${DISPATCH_ID}/reschedule`)
      .send({ sendAt })

  const daysFromNow = (days: number) =>
    new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()

  it('returns 404 for an unknown dispatch', async () => {
    getDispatchByIdMock.mockResolvedValue(null)

    const res = await reschedule(daysFromNow(1))

    expect(res.status).toBe(404)
    expect(rescheduleScheduledBulkMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the dispatch is not scheduled', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['cancelled'])
    )

    const res = await reschedule(daysFromNow(1))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NOT_SCHEDULED')
  })

  it('rejects a sendAt in the past', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )

    const res = await reschedule(daysFromNow(-1))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SEND_AT_IN_PAST')
    expect(rescheduleScheduledBulkMock).not.toHaveBeenCalled()
  })

  it('rejects a sendAt within the grace window (no effective reschedule)', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )

    const res = await reschedule(new Date(Date.now() + 10 * 1000).toISOString())

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SEND_AT_TOO_SOON')
    expect(rescheduleScheduledBulkMock).not.toHaveBeenCalled()
  })

  it('rejects a sendAt at or before the current schedule (Infobip only postpones)', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'], daysFromNow(3))
    )

    const res = await reschedule(daysFromNow(2))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SEND_AT_NOT_LATER')
    expect(rescheduleScheduledBulkMock).not.toHaveBeenCalled()
  })

  it('enforces the channel cap: 6 days is rejected for email but fine for sms', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('email', ['scheduled'])
    )
    const sendAt = daysFromNow(6)

    const emailRes = await reschedule(sendAt)
    expect(emailRes.status).toBe(400)
    expect(emailRes.body.error).toBe('SEND_AT_TOO_FAR_AHEAD')

    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    const smsRes = await reschedule(sendAt)
    expect(smsRes.status).toBe(200)
  })

  it('reschedules at Infobip first, then updates the dispatch sendAt', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    const sendAt = daysFromNow(2)

    const res = await reschedule(sendAt)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      sendAt: new Date(sendAt).toISOString(),
    })
    expect(rescheduleScheduledBulkMock).toHaveBeenCalledWith(
      'sms',
      DISPATCH_ID,
      new Date(sendAt)
    )
    expect(updateDispatchSendAtMock).toHaveBeenCalledWith(
      DISPATCH_ID,
      new Date(sendAt)
    )
  })

  it('returns 409 and leaves sendAt untouched when Infobip refuses', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    rescheduleScheduledBulkMock.mockRejectedValue(
      new ScheduledBulkConflictError(400, 'bulk already processed')
    )

    const res = await reschedule(daysFromNow(1))

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
    expect(updateDispatchSendAtMock).not.toHaveBeenCalled()
  })
})
