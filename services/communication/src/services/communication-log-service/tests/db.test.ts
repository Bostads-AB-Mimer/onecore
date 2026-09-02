const insertMock = jest.fn().mockReturnValue({
  returning: jest.fn().mockResolvedValue([{ id: 'dispatch-1' }]),
})
const batchInsertMock = jest.fn().mockResolvedValue(undefined)

const trx = jest.fn(() => ({ insert: insertMock }))
Object.assign(trx, { batchInsert: batchInsertMock })

jest.mock('knex', () => {
  const client = jest.fn()
  Object.assign(client, {
    transaction: (fn: (t: unknown) => unknown) => fn(trx),
  })
  return jest.fn(() => client)
})

jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { logOutboundDispatch } from '../adapters/db'

describe('logOutboundDispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    insertMock.mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'dispatch-1' }]),
    })
  })

  // MIM-1957: the communication log links each row to its Odoo errand via the
  // od-<id> code; the frontend builds the deep link from that code alone.
  it('persists workOrderCode on the dispatch row', async () => {
    await logOutboundDispatch({
      channel: 'my-pages',
      fromAddress: 'Mimer',
      body: 'Hej!',
      messageType: 'work_order_tenant_my_pages',
      provider: 'odoo',
      workOrderCode: 'od-12345',
      recipients: [{ contactCode: 'P123456', toAddress: 'Mina sidor' }],
    })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'my-pages',
        workOrderCode: 'od-12345',
      })
    )
  })

  it('writes null workOrderCode when the caller omits it', async () => {
    await logOutboundDispatch({
      channel: 'sms',
      fromAddress: 'Mimer',
      body: 'Hej!',
      messageType: 'bulk_sms',
      provider: 'tele2',
      recipients: [{ toAddress: '46700000000' }],
    })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ workOrderCode: null })
    )
  })
})
