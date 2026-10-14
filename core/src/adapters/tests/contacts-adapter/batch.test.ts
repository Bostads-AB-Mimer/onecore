import nock from 'nock'

import config from '../../../common/config'
import { makeContactsAdapter } from '../../contacts-adapter'

const adapter = makeContactsAdapter(config.contactsService.url)
const base = config.contactsService.url

beforeAll(() => nock.disableNetConnect())
afterAll(() => nock.enableNetConnect())
afterEach(() => nock.cleanAll())

describe('contactsAdapter.getByContactCodeBatch', () => {
  it('returns an empty array without a request when given no contact codes', async () => {
    const result = await adapter.getByContactCodeBatch([])

    expect(result).toEqual({ ok: true, data: [] })
    expect(nock.pendingMocks()).toHaveLength(0)
  })

  it('sends a single request for a batch under the chunk size', async () => {
    const scope = nock(base)
      .get('/contacts/batch')
      .query(true)
      .reply(200, { content: { contacts: [{ contactCode: 'P1' }] } })

    const result = await adapter.getByContactCodeBatch(['P1'])

    expect(result).toEqual({ ok: true, data: [{ contactCode: 'P1' }] })
    scope.done()
  })

  it('splits large batches into chunks and merges the results', async () => {
    const codes = Array.from({ length: 900 }, (_, i) => `P${i}`)

    let seenCodes: string[] = []
    nock(base)
      .get('/contacts/batch')
      .query(true)
      .times(2)
      .reply(200, function () {
        const url = new URL(this.req.path, base)
        const chunkCodes = url.searchParams.getAll('code')
        seenCodes = seenCodes.concat(chunkCodes)
        return {
          content: {
            contacts: chunkCodes.map((code) => ({ contactCode: code })),
          },
        }
      })

    const result = await adapter.getByContactCodeBatch(codes)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(900)
    }
    expect(seenCodes.sort()).toEqual([...codes].sort())
  })

  it('returns failure if any chunk request fails', async () => {
    const codes = Array.from({ length: 900 }, (_, i) => `P${i}`)

    nock(base)
      .get('/contacts/batch')
      .query(true)
      .reply(200, { content: { contacts: [] } })
    nock(base).get('/contacts/batch').query(true).reply(500, {})

    const result = await adapter.getByContactCodeBatch(codes)

    expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
  })
})
