import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../index'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /leases/:leaseId/preliminary-termination', () => {
  const validRequestBody = {
    contactCode: 'P12345',
    lastDebitDate: '2025-12-31T00:00:00.000Z',
    desiredMoveDate: '2025-12-31T00:00:00.000Z',
  }

  it('should return 400 if contactCode is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        lastDebitDate: '2025-12-31T00:00:00.000Z',
        desiredMoveDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'Invalid request body',
    })
  })

  it('should return 400 if lastDebitDate is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        desiredMoveDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'Invalid request body',
    })
  })

  it('should return 400 if desiredMoveDate is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        lastDebitDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'Invalid request body',
    })
  })

  it('should return 400 if lastDebitDate is not a valid datetime', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        lastDebitDate: 'invalid-date',
        desiredMoveDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'Invalid request body',
    })
  })

  it('should return 400 if desiredMoveDate is not a valid datetime', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        lastDebitDate: '2025-12-31T00:00:00.000Z',
        desiredMoveDate: 'invalid-date',
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'Invalid request body',
    })
  })

  it('should return 404 if tenant is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'tenant-not-found',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      error: 'tenant-not-found',
      message: 'Tenant not found',
    })
  })

  it('should return 404 if lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'lease-not-found',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      error: 'lease-not-found',
      message: 'Lease not found',
    })
  })

  it('should return 500 if termination fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'termination-failed',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      error: 'termination-failed',
      message: 'Failed to terminate lease',
    })
  })

  it('should return 500 for unknown errors', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      error: 'unknown',
      message: 'Failed to terminate lease',
    })
  })

  it('should return 200 and success message when termination succeeds', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      content: { message: 'Signerings begäran skickad' },
    })
  })

  it('should handle leaseId with special characters', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(tenfastAdapter.preliminaryTerminateLease).toHaveBeenCalledWith(
      '216-704-00-0022/02',
      'P12345',
      new Date('2025-12-31T00:00:00.000Z'),
      new Date('2025-12-31T00:00:00.000Z')
    )
  })

  it('should convert ISO datetime strings to Date objects', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/123-456/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(tenfastAdapter.preliminaryTerminateLease).toHaveBeenCalledWith(
      '123-456',
      'P12345',
      expect.any(Date),
      expect.any(Date)
    )
  })
})
