import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../message-templates'
import * as templatesAdapter from '../../../adapters/communication-adapter/message-templates'

const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111'

const template = {
  id: TEMPLATE_ID,
  name: 'Nyckel klar',
  channels: ['sms' as const],
  subject: null,
  body: 'Hej! Din nyckel finns att hämta.',
  smsText: 'Hej! Din nyckel finns att hämta.',
  categories: [],
  isActive: true,
  revision: 1,
  updatedBy: null,
  createdAt: new Date('2026-11-06T00:00:00.000Z'),
  updatedAt: new Date('2026-11-06T00:00:00.000Z'),
}

const app = new Koa()
const router = new KoaRouter()
app.use(async (ctx, next) => {
  ctx.state.user = { name: 'Åsa Öberg', realm_access: { roles: [] } }
  await next()
})
app.use(bodyParser())
routes(router)
app.use(router.routes())

beforeEach(jest.restoreAllMocks)

describe('GET /message-templates', () => {
  it('wraps the list in content and defaults to active', async () => {
    const spy = jest
      .spyOn(templatesAdapter, 'listTemplates')
      .mockResolvedValue({ ok: true, data: [template] })

    const res = await request(app.callback()).get('/message-templates')

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0].id).toBe(TEMPLATE_ID)
    expect(spy).toHaveBeenCalledWith('active')
  })

  it('rejects an unknown status filter without calling the service', async () => {
    const spy = jest.spyOn(templatesAdapter, 'listTemplates')

    const res = await request(app.callback())
      .get('/message-templates')
      .query({ status: 'bogus' })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('POST /message-templates', () => {
  it('validates the body before calling the service', async () => {
    const spy = jest.spyOn(templatesAdapter, 'createTemplate')

    const res = await request(app.callback())
      .post('/message-templates')
      .send({ name: '', body: 'Hej' })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns 201 with the created template', async () => {
    jest
      .spyOn(templatesAdapter, 'createTemplate')
      .mockResolvedValue({ ok: true, data: template })

    const res = await request(app.callback())
      .post('/message-templates')
      .send({ name: 'Nyckel klar', body: 'Hej! Din nyckel finns att hämta.' })

    expect(res.status).toBe(201)
    expect(res.body.content.name).toBe('Nyckel klar')
  })

  it('stamps updatedBy from the token, not the client', async () => {
    const spy = jest
      .spyOn(templatesAdapter, 'createTemplate')
      .mockResolvedValue({ ok: true, data: template })

    await request(app.callback())
      .post('/message-templates')
      .send({ name: 'Nyckel klar', body: 'Hej', updatedBy: 'Någon annan' })

    expect(spy).toHaveBeenCalledWith({
      name: 'Nyckel klar',
      body: 'Hej',
      updatedBy: 'Åsa Öberg',
    })
  })

  it('forwards the upstream 409 code', async () => {
    jest.spyOn(templatesAdapter, 'createTemplate').mockResolvedValue({
      ok: false,
      err: 'TEMPLATE_NAME_TAKEN',
      statusCode: 409,
    })

    const res = await request(app.callback())
      .post('/message-templates')
      .send({ name: 'Nyckel klar', body: 'Hej' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_NAME_TAKEN')
  })
})

describe('PUT /message-templates/:id', () => {
  it('rejects an empty update', async () => {
    const spy = jest.spyOn(templatesAdapter, 'updateTemplate')

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ revision: 1 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NO_FIELDS')
    expect(spy).not.toHaveBeenCalled()
  })

  it('forwards 404 from the service', async () => {
    jest.spyOn(templatesAdapter, 'updateTemplate').mockResolvedValue({
      ok: false,
      err: 'TEMPLATE_NOT_FOUND',
      statusCode: 404,
    })

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ body: 'Ny text', revision: 1 })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('TEMPLATE_NOT_FOUND')
  })

  it('forwards 409 TEMPLATE_CHANGED and passes the revision on', async () => {
    const spy = jest
      .spyOn(templatesAdapter, 'updateTemplate')
      .mockResolvedValue({
        ok: false,
        err: 'TEMPLATE_CHANGED',
        statusCode: 409,
      })

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ body: 'Ny text', revision: 4 })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_CHANGED')
    expect(spy).toHaveBeenCalledWith(TEMPLATE_ID, {
      body: 'Ny text',
      revision: 4,
      updatedBy: 'Åsa Öberg',
    })
  })

  it('requires a revision', async () => {
    const spy = jest.spyOn(templatesAdapter, 'updateTemplate')

    const res = await request(app.callback())
      .put(`/message-templates/${TEMPLATE_ID}`)
      .send({ body: 'Ny text' })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('POST /message-templates/preview', () => {
  it('returns the SMS text and forwards validation codes', async () => {
    jest
      .spyOn(templatesAdapter, 'previewTemplate')
      .mockResolvedValueOnce({ ok: true, data: { text: 'Hej' } })
      .mockResolvedValueOnce({
        ok: false,
        err: 'INVALID_URL',
        statusCode: 400,
      })

    const ok = await request(app.callback())
      .post('/message-templates/preview')
      .send({ body: '**Hej**' })
    const bad = await request(app.callback())
      .post('/message-templates/preview')
      .send({ body: '[a](http://x.se)' })

    expect(ok.status).toBe(200)
    expect(ok.body.content.text).toBe('Hej')
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('INVALID_URL')
  })
})

describe('archive / restore', () => {
  it('archives through the adapter', async () => {
    const spy = jest
      .spyOn(templatesAdapter, 'archiveTemplate')
      .mockResolvedValue({ ok: true, data: { ...template, isActive: false } })

    const res = await request(app.callback()).post(
      `/message-templates/${TEMPLATE_ID}/archive`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.isActive).toBe(false)
    expect(spy).toHaveBeenCalledWith(TEMPLATE_ID)
  })

  it('forwards 409 when restoring into a taken name', async () => {
    jest.spyOn(templatesAdapter, 'restoreTemplate').mockResolvedValue({
      ok: false,
      err: 'TEMPLATE_NAME_TAKEN',
      statusCode: 409,
    })

    const res = await request(app.callback()).post(
      `/message-templates/${TEMPLATE_ID}/restore`
    )

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_NAME_TAKEN')
  })
})
