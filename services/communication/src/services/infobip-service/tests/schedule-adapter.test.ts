import {
  cancelScheduledBulk,
  rescheduleScheduledBulk,
  ScheduledBulkConflictError,
} from '../adapters/schedule-adapter'

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
}))

jest.mock('../../../common/config', () => ({
  infobip: { baseUrl: 'https://infobip.test', apiKey: 'email-key' },
  tele2: { baseUrl: 'https://tele2.test', apiKey: 'sms-key' },
}))

const BULK_ID = '5a748f19-fca0-4562-9f8d-05eb0e16d076'
const SEND_AT = new Date('2026-08-01T10:00:00.000Z')

const okResponse = () =>
  ({ ok: true, status: 200, text: async () => '{}' }) as Response
const errorResponse = (status: number, body: string) =>
  ({ ok: false, status, text: async () => body }) as Response

let fetchMock: jest.SpyInstance

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(okResponse())
})

afterEach(() => {
  fetchMock.mockRestore()
})

// (url, body) pairs of every fetch call, for asserting the PUT sequence.
const calls = () =>
  fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => ({
    url,
    body: JSON.parse(String(init.body)),
  }))

describe(rescheduleScheduledBulk, () => {
  it('pauses, reschedules, then resumes — in that order', async () => {
    await rescheduleScheduledBulk('email', BULK_ID, SEND_AT)

    expect(calls()).toEqual([
      {
        url: `https://infobip.test/email/1/bulks/status?bulkId=${BULK_ID}`,
        body: { status: 'PAUSED' },
      },
      {
        url: `https://infobip.test/email/1/bulks?bulkId=${BULK_ID}`,
        body: { sendAt: '2026-08-01T10:00:00.000Z' },
      },
      {
        url: `https://infobip.test/email/1/bulks/status?bulkId=${BULK_ID}`,
        body: { status: 'PENDING' },
      },
    ])
  })

  it('uses the Tele2 API for sms', async () => {
    await rescheduleScheduledBulk('sms', BULK_ID, SEND_AT)

    expect(calls()[0].url).toBe(
      `https://tele2.test/sms/1/bulks/status?bulkId=${BULK_ID}`
    )
  })

  it('still resumes when the reschedule PUT fails, then rethrows', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse()) // pause
      .mockResolvedValueOnce(errorResponse(404, 'not eligible')) // reschedule
      .mockResolvedValueOnce(okResponse()) // resume

    await expect(
      rescheduleScheduledBulk('email', BULK_ID, SEND_AT)
    ).rejects.toThrow(ScheduledBulkConflictError)

    expect(calls()[2].body).toEqual({ status: 'PENDING' })
  })

  it('fails loudly when the bulk cannot be resumed', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse()) // pause
      .mockResolvedValueOnce(okResponse()) // reschedule
      .mockResolvedValueOnce(errorResponse(500, 'oops')) // resume

    await expect(
      rescheduleScheduledBulk('email', BULK_ID, SEND_AT)
    ).rejects.toThrow(/left PAUSED/)
  })
})

describe(cancelScheduledBulk, () => {
  it('PUTs CANCELED on the status endpoint', async () => {
    await cancelScheduledBulk('email', BULK_ID)

    expect(calls()).toEqual([
      {
        url: `https://infobip.test/email/1/bulks/status?bulkId=${BULK_ID}`,
        body: { status: 'CANCELED' },
      },
    ])
  })

  it('maps 4xx to ScheduledBulkConflictError', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'not found'))

    await expect(cancelScheduledBulk('sms', BULK_ID)).rejects.toThrow(
      ScheduledBulkConflictError
    )
  })

  it('maps 401/403 to a plain error (account permissions), not a conflict', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'Unauthorized access'))

    const promise = cancelScheduledBulk('sms', BULK_ID)
    await expect(promise).rejects.toThrow(/bulk-management permissions/)
    await expect(promise).rejects.not.toThrow(ScheduledBulkConflictError)
  })
})
