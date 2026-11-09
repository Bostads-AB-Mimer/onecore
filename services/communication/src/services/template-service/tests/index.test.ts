import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import * as dbAdapter from '../adapters/db'

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}))

jest.mock('../adapters/db', () => ({
  ...jest.requireActual('../adapters/db'),
  listTemplates: jest.fn(),
  getTemplateById: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  setTemplateActive: jest.fn(),
}))

const listMock = dbAdapter.listTemplates as jest.Mock
const getMock = dbAdapter.getTemplateById as jest.Mock
const createMock = dbAdapter.createTemplate as jest.Mock
const updateMock = dbAdapter.updateTemplate as jest.Mock
const setActiveMock = dbAdapter.setTemplateActive as jest.Mock

const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111'

const template = {
  id: TEMPLATE_ID,
  name: 'Nyckel klar',
  channels: ['sms'],
  subject: null,
  body: 'Hej! Din nyckel finns att hämta.',
  categories: [],
  isActive: true,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
}

// Shape of the error knex surfaces from tedious on a unique index violation.
const uniqueViolation = Object.assign(
  new Error('Cannot insert duplicate key'),
  { number: 2601 }
)

const app = new Koa()
const router = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => jest.clearAllMocks())

describe('GET /message-templates', () => {
  it('lists active templates by default', async () => {
    listMock.mockResolvedValue([template])

    const res = await request(app.callback()).get('/message-templates')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([template])
    expect(listMock).toHaveBeenCalledWith('active')
  })

  it('passes the status filter through', async () => {
    listMock.mockResolvedValue([])

    const res = await request(app.callback())
      .get('/message-templates')
      .query({ status: 'archived' })

    expect(res.status).toBe(200)
    expect(listMock).toHaveBeenCalledWith('archived')
  })

  it('rejects an unknown status filter', async () => {
    const res = await request(app.callback())
      .get('/message-templates')
      .query({ status: 'bogus' })

    expect(res.status).toBe(400)
    expect(listMock).not.toHaveBeenCalled()
  })
})

describe('GET /message-templates/:id', () => {
  it('returns 404 with a code for an unknown id', async () => {
    getMock.mockResolvedValue(null)

    const res = await request(app.callback()).get(
      `/message-templates/${TEMPLATE_ID}`
    )

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('TEMPLATE_NOT_FOUND')
  })
})

describe('POST /message-templates', () => {
  it('creates a template', async () => {
    createMock.mockResolvedValue(template)

    const res = await request(app.callback())
      .post('/message-templates')
      .send({ name: 'Nyckel klar', body: 'Hej! Din nyckel finns att hämta.' })

    expect(res.status).toBe(201)
    expect(res.body).toEqual(template)
    expect(createMock).toHaveBeenCalledWith({
      name: 'Nyckel klar',
      body: 'Hej! Din nyckel finns att hämta.',
    })
  })

  it('rejects an empty body text', async () => {
    const res = await request(app.callback())
      .post('/message-templates')
      .send({ name: 'Nyckel klar', body: '   ' })

    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('maps a unique violation to 409 TEMPLATE_NAME_TAKEN', async () => {
    createMock.mockRejectedValue(uniqueViolation)

    const res = await request(app.callback())
      .post('/message-templates')
      .send({ name: 'Nyckel klar', body: 'Hej!' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_NAME_TAKEN')
  })
})

describe('PUT /message-templates/:id', () => {
  it('updates the supplied fields', async () => {
    updateMock.mockResolvedValue({ ...template, body: 'Ny text' })

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ body: 'Ny text' })

    expect(res.status).toBe(200)
    expect(res.body.body).toBe('Ny text')
    expect(updateMock).toHaveBeenCalledWith(TEMPLATE_ID, { body: 'Ny text' })
  })

  it('rejects an empty update', async () => {
    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NO_FIELDS')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown id', async () => {
    updateMock.mockResolvedValue(null)

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ name: 'Annat' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('TEMPLATE_NOT_FOUND')
  })

  it('maps a rename into a taken name to 409', async () => {
    updateMock.mockRejectedValue(uniqueViolation)

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ name: 'Upptaget' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_NAME_TAKEN')
  })
})

describe('POST /message-templates/:id/archive and /restore', () => {
  it('archives by clearing isActive', async () => {
    setActiveMock.mockResolvedValue({ ...template, isActive: false })

    const res = await request(app.callback()).post(
      `/message-templates/${TEMPLATE_ID}/archive`
    )

    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(false)
    expect(setActiveMock).toHaveBeenCalledWith(TEMPLATE_ID, false)
  })

  it('restores by setting isActive', async () => {
    setActiveMock.mockResolvedValue(template)

    const res = await request(app.callback()).post(
      `/message-templates/${TEMPLATE_ID}/restore`
    )

    expect(res.status).toBe(200)
    expect(setActiveMock).toHaveBeenCalledWith(TEMPLATE_ID, true)
  })

  it('returns 404 when archiving an unknown id', async () => {
    setActiveMock.mockResolvedValue(null)

    const res = await request(app.callback()).post(
      `/message-templates/${TEMPLATE_ID}/archive`
    )

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('TEMPLATE_NOT_FOUND')
  })

  it('returns 409 when restoring into a name an active template holds', async () => {
    setActiveMock.mockRejectedValue(uniqueViolation)

    const res = await request(app.callback()).post(
      `/message-templates/${TEMPLATE_ID}/restore`
    )

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_NAME_TAKEN')
  })
})
