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
import { getScheduleRules } from '../../scheduled-sends/rules'

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

// Keep the pure rule functions; only the config-backed rules are mocked so
// the tests don't depend on .env.test.
jest.mock('../../scheduled-sends/rules', () => ({
  ...jest.requireActual('../../scheduled-sends/rules'),
  getScheduleRules: jest.fn(),
}))

const getDispatchByIdMock = getDispatchById as jest.Mock
const cancelScheduledRecipientsMock = cancelScheduledRecipients as jest.Mock
const updateDispatchSendAtMock = updateDispatchSendAt as jest.Mock
const getScheduleRulesMock = getScheduleRules as jest.Mock

const app = new Koa()
const okapi = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(okapi)
app.use(bodyParser())
app.use(okapi.routes())

const DISPATCH_ID = '5a748f19-fca0-4562-9f8d-05eb0e16d076'

const RULES = {
  enabled: true,
  blockedFrom: '21:00',
  blockedUntil: '07:00',
  maxDaysAhead: 30,
}

// Only the fields the routes actually read.
const dispatchWithStatuses = (
  channel: 'sms' | 'email',
  statuses: string[],
  sendAt: string | Date = new Date(Date.now() + 30 * 60 * 1000)
) => ({
  dispatch: { id: DISPATCH_ID, channel, sendAt },
  recipients: statuses.map((status, i) => ({ id: `r${i}`, status })),
})

// Next 10-minute slot at 12:00 local (always open), `days` days ahead.
const openSlotDaysAhead = (days: number) => {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000)
  d.setUTCHours(10, 0, 0, 0)
  return d.toISOString()
}

beforeEach(() => {
  getDispatchByIdMock.mockReset()
  cancelScheduledRecipientsMock.mockReset()
  updateDispatchSendAtMock.mockReset()
  getScheduleRulesMock.mockReset()
  getScheduleRulesMock.mockReturnValue(RULES)
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
    expect(cancelScheduledRecipientsMock).not.toHaveBeenCalled()
  })

  it('returns 409 when no recipient is scheduled any more', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['sent', 'failed'])
    )

    const res = await cancel()

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
    expect(cancelScheduledRecipientsMock).not.toHaveBeenCalled()
  })

  it('is idempotent: an already-cancelled dispatch returns 200 with 0', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['cancelled', 'cancelled'])
    )

    const res = await cancel()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      cancelledRecipients: 0,
    })
    expect(cancelScheduledRecipientsMock).not.toHaveBeenCalled()
  })

  it('cancels the scheduled recipients and returns the count', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled', 'scheduled'])
    )

    const res = await cancel()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      cancelledRecipients: 2,
    })
    expect(cancelScheduledRecipientsMock).toHaveBeenCalledWith(DISPATCH_ID)
  })

  it('cancels the rest of a partly processed dispatch (SMS and email alike)', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('email', ['sent', 'sending', 'scheduled'])
    )
    cancelScheduledRecipientsMock.mockResolvedValue({ updatedCount: 1 })

    const res = await cancel()

    expect(res.status).toBe(200)
    expect(res.body.cancelledRecipients).toBe(1)
  })

  it('returns 409 when the worker claimed the last scheduled row in between', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    cancelScheduledRecipientsMock.mockResolvedValue({ updatedCount: 0 })

    const res = await cancel()

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
  })

  it('returns CANCEL_FAILED when the DB update throws', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    cancelScheduledRecipientsMock.mockRejectedValue(new Error('db down'))

    const res = await cancel()

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('CANCEL_FAILED')
  })
})

describe('POST /communication-log/dispatches/:id/reschedule', () => {
  const reschedule = (sendAt: string) =>
    request(app.callback())
      .post(`/communication-log/dispatches/${DISPATCH_ID}/reschedule`)
      .send({ sendAt })

  it('returns 404 for an unknown dispatch', async () => {
    getDispatchByIdMock.mockResolvedValue(null)

    const res = await reschedule(openSlotDaysAhead(1))

    expect(res.status).toBe(404)
    expect(updateDispatchSendAtMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the dispatch is no longer scheduled', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['cancelled'])
    )

    const res = await reschedule(openSlotDaysAhead(1))

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
  })

  it('returns 409 for a partly processed dispatch (would reset the staleness clock)', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled', 'sending'])
    )

    const res = await reschedule(openSlotDaysAhead(1))

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
    expect(updateDispatchSendAtMock).not.toHaveBeenCalled()
  })

  it('rejects a sendAt in the past', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )

    const res = await reschedule(openSlotDaysAhead(-1))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SEND_AT_IN_PAST')
    expect(updateDispatchSendAtMock).not.toHaveBeenCalled()
  })

  it('rejects a sendAt within the grace window (no effective reschedule)', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )

    const res = await reschedule(new Date(Date.now() + 10 * 1000).toISOString())

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SEND_AT_TOO_SOON')
  })

  it('rejects a sendAt off the slot grid or in blocked hours', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    const offSlot = new Date(openSlotDaysAhead(1))
    offSlot.setUTCMinutes(5)

    const offSlotRes = await reschedule(offSlot.toISOString())
    expect(offSlotRes.status).toBe(400)
    expect(offSlotRes.body.error).toBe('SEND_AT_OFF_SLOT')

    // 23:00 local (summer: 21:00Z; winter: 22:00Z) — blocked either way.
    const blocked = new Date(openSlotDaysAhead(1))
    blocked.setUTCHours(21, 30, 0, 0)
    const blockedRes = await reschedule(blocked.toISOString())
    expect(blockedRes.status).toBe(400)
    expect(blockedRes.body.error).toBe('SEND_AT_IN_BLOCKED_HOURS')
  })

  it('rejects any sendAt when scheduling is disabled', async () => {
    getScheduleRulesMock.mockReturnValue({ ...RULES, enabled: false })
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )

    const res = await reschedule(openSlotDaysAhead(1))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SCHEDULING_DISABLED')
  })

  it('enforces max days ahead for both channels', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('email', ['scheduled'])
    )

    const res = await reschedule(openSlotDaysAhead(31))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SEND_AT_TOO_FAR_AHEAD')
  })

  it('moves the dispatch earlier as well as later', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'], openSlotDaysAhead(3))
    )
    const sendAt = openSlotDaysAhead(1)

    const res = await reschedule(sendAt)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      dispatchId: DISPATCH_ID,
      sendAt: new Date(sendAt).toISOString(),
    })
    expect(updateDispatchSendAtMock).toHaveBeenCalledWith(
      DISPATCH_ID,
      new Date(sendAt)
    )
  })

  it('returns 409 when the worker claimed a recipient between read and write', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    updateDispatchSendAtMock.mockResolvedValue({ updatedCount: 0 })

    const res = await reschedule(openSlotDaysAhead(1))

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_PROCESSED')
  })

  it('returns RESCHEDULE_FAILED when the DB update throws', async () => {
    getDispatchByIdMock.mockResolvedValue(
      dispatchWithStatuses('sms', ['scheduled'])
    )
    updateDispatchSendAtMock.mockRejectedValue(new Error('db down'))

    const res = await reschedule(openSlotDaysAhead(1))

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('RESCHEDULE_FAILED')
  })
})

describe('GET /communication-log/schedule-config', () => {
  it('exposes the configured rules', async () => {
    const res = await request(app.callback()).get(
      '/communication-log/schedule-config'
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      enabled: true,
      timeZone: 'Europe/Stockholm',
      slotMinutes: 10,
      blockedHours: { from: '21:00', until: '07:00' },
      maxDaysAhead: 30,
    })
  })

  it('reports enabled: false so the frontend hides scheduling', async () => {
    getScheduleRulesMock.mockReturnValue({ ...RULES, enabled: false })

    const res = await request(app.callback()).get(
      '/communication-log/schedule-config'
    )

    expect(res.body.enabled).toBe(false)
  })
})
