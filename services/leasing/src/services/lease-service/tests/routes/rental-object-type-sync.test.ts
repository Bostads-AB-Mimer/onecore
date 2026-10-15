import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/rental-object-type-sync'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as cmlogRentalObjectAdapter from '../../adapters/xpand/cmlog-rental-object-adapter'
import * as factory from '../factories'

jest.mock('../../adapters/xpand/xpandDb', () => ({
  xpandDb: {},
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const getRentalObjectTypeChanges = jest.spyOn(
  cmlogRentalObjectAdapter,
  'getRentalObjectTypeChanges'
)
const getRentalObject = jest.spyOn(tenfastAdapter, 'getRentalObject')
const updateRentalObjectCategory = jest.spyOn(
  tenfastAdapter,
  'updateRentalObjectCategory'
)

beforeEach(() => {
  jest.resetAllMocks()
})

describe('GET /rental-objects/types/sync', () => {
  it('returns 200 with the changes', async () => {
    const change = {
      rentalObjectCode: '807-033-01-0101',
      code: 'POÄNGFRITT',
      label: 'Poängfritt',
      timestamp: new Date('2026-10-15T08:08:28.000Z'),
    }
    getRentalObjectTypeChanges.mockResolvedValueOnce([change])

    const res = await request(app.callback()).get(
      '/rental-objects/types/sync?since=2026-10-15T00:00:00.000Z'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      { ...change, timestamp: '2026-10-15T08:08:28.000Z' },
    ])
    expect(getRentalObjectTypeChanges).toHaveBeenCalledWith(
      new Date('2026-10-15T00:00:00.000Z')
    )
  })

  it('returns 400 when since is missing', async () => {
    const res = await request(app.callback()).get('/rental-objects/types/sync')

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
    expect(getRentalObjectTypeChanges).not.toHaveBeenCalled()
  })

  it('returns 400 when since is not a date', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects/types/sync?since=not-a-date'
    )

    expect(res.status).toBe(400)
    expect(getRentalObjectTypeChanges).not.toHaveBeenCalled()
  })

  it('returns 500 when reading cmlog throws', async () => {
    getRentalObjectTypeChanges.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app.callback()).get(
      '/rental-objects/types/sync?since=2026-10-15T00:00:00.000Z'
    )

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('db down')
  })
})

describe('POST /rental-objects/:rentalObjectCode/type/sync', () => {
  const post = (body: unknown) =>
    request(app.callback())
      .post('/rental-objects/807-033-01-0101/type/sync')
      .send(body as object)

  it('returns 422 without calling Tenfast when code is null', async () => {
    const res = await post({ code: null })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('unknown-rental-object-type')
    expect(getRentalObject).not.toHaveBeenCalled()
  })

  it('returns 422 without calling Tenfast when code is not a Tenfast category', async () => {
    const res = await post({ code: 'HDK' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('unknown-rental-object-type')
    expect(getRentalObject).not.toHaveBeenCalled()
  })

  it('returns 400 when the body has no code', async () => {
    const res = await post({})

    expect(res.status).toBe(400)
    expect(getRentalObject).not.toHaveBeenCalled()
  })

  it('returns skipped when the rental object is not in Tenfast', async () => {
    getRentalObject.mockResolvedValueOnce({ ok: true, data: null })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      action: 'skipped',
      rentalObjectCode: '807-033-01-0101',
    })
    expect(getRentalObject).toHaveBeenCalledWith('807-033-01-0101')
    expect(updateRentalObjectCategory).not.toHaveBeenCalled()
  })

  it('returns unchanged without patching when the category already matches', async () => {
    getRentalObject.mockResolvedValueOnce({
      ok: true,
      data: factory.tenfastRentalObject.build({
        _id: 'tf-1',
        category: { code: 'POÄNGFRITT', label: 'Poängfritt' },
      }),
    })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(200)
    expect(res.body.content.action).toBe('unchanged')
    expect(updateRentalObjectCategory).not.toHaveBeenCalled()
  })

  it("patches with Tenfast's label and returns updated", async () => {
    getRentalObject.mockResolvedValueOnce({
      ok: true,
      data: factory.tenfastRentalObject.build({
        _id: 'tf-1',
        category: { code: 'STD', label: 'Standard hyresobjektstyp' },
      }),
    })
    updateRentalObjectCategory.mockResolvedValueOnce({ ok: true, data: null })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      action: 'updated',
      rentalObjectCode: '807-033-01-0101',
    })
    expect(updateRentalObjectCategory).toHaveBeenCalledWith('tf-1', {
      code: 'POÄNGFRITT',
      label: 'Poängfritt',
    })
  })

  it('returns 500 when the Tenfast lookup fails', async () => {
    getRentalObject.mockResolvedValueOnce({
      ok: false,
      err: 'could-not-find-rental-object',
    })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('could-not-find-rental-object')
    expect(updateRentalObjectCategory).not.toHaveBeenCalled()
  })

  it('returns 422 rental-object-rejected when the Tenfast rental object cannot be parsed', async () => {
    getRentalObject.mockResolvedValueOnce({
      ok: false,
      err: 'could-not-parse-rental-object',
    })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('rental-object-rejected')
    expect(updateRentalObjectCategory).not.toHaveBeenCalled()
  })

  it('returns 422 rental-object-rejected when Tenfast rejects the update', async () => {
    getRentalObject.mockResolvedValueOnce({
      ok: true,
      data: factory.tenfastRentalObject.build({
        _id: 'tf-1',
        category: { code: 'STD', label: 'Standard hyresobjektstyp' },
      }),
    })
    updateRentalObjectCategory.mockResolvedValueOnce({
      ok: false,
      err: 'update-rejected',
    })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('rental-object-rejected')
  })

  it('returns 500 when the Tenfast update fails', async () => {
    getRentalObject.mockResolvedValueOnce({
      ok: true,
      data: factory.tenfastRentalObject.build({
        _id: 'tf-1',
        category: { code: 'STD', label: 'Standard hyresobjektstyp' },
      }),
    })
    updateRentalObjectCategory.mockResolvedValueOnce({
      ok: false,
      err: 'update-failed',
    })

    const res = await post({ code: 'POÄNGFRITT' })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('update-failed')
  })
})
