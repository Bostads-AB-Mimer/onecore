import nock from 'nock'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'

describe(economyAdapter.processIMD, () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('returns enriched data on success', async () => {
    const mockContent = {
      totalRows: 3,
      numEnriched: 2,
      numUnprocessed: 1,
      enrichedCsv: 'Kontraktsnummer;Hyresartikel\nL1;IMDM',
      unprocessedCsv: 'Hyresobjektskod;Orsak\nX;Saknas',
    }

    nock(config.economyService.url)
      .post('/imd/process', { csv: 'test-csv' })
      .reply(200, { content: mockContent })

    const result = await economyAdapter.processIMD('test-csv')

    expect(result).toStrictEqual({ ok: true, data: mockContent })
  })

  it('returns error on non-200 response', async () => {
    nock(config.economyService.url)
      .post('/imd/process')
      .reply(500, { error: 'Internal error' })

    const result = await economyAdapter.processIMD('test-csv')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })

  it('returns error on network failure', async () => {
    nock(config.economyService.url)
      .post('/imd/process')
      .replyWithError('connection refused')

    const result = await economyAdapter.processIMD('test-csv')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
      expect(result.statusCode).toBe(500)
    }
  })
})
