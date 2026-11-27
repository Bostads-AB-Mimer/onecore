import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../system-routes'
import * as dbAdapter from '../adapters/db'

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}))

jest.mock('../adapters/db', () => ({
  ...jest.requireActual('../adapters/db'),
  listSystemTemplates: jest.fn(),
  getSystemTemplateRecord: jest.fn(),
  updateSystemTemplate: jest.fn(),
}))

const listMock = dbAdapter.listSystemTemplates as jest.Mock
const getMock = dbAdapter.getSystemTemplateRecord as jest.Mock
const updateMock = dbAdapter.updateSystemTemplate as jest.Mock

const record: dbAdapter.SystemTemplateRecord = {
  key: 'work_order',
  name: 'Meddelande i ärende',
  channels: ['email'],
  subject: 'Du har fått ett meddelande i ditt ärende',
  body: '{{message}}\n\nMed vänlig hälsning\n**Mimer**',
  revision: 3,
  updatedBy: 'Åsa',
  updatedAt: new Date('2026-11-26T08:00:00.000Z'),
}

const app = new Koa()
const router = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => jest.clearAllMocks())

describe('GET /system-templates/:key', () => {
  it('adds the placeholders, logo and footer the editor shows', async () => {
    getMock.mockResolvedValue(record)

    const res = await request(app.callback()).get(
      '/system-templates/work_order'
    )

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ key: 'work_order', revision: 3 })
    expect(res.body.placeholders).toEqual([
      expect.objectContaining({
        token: 'message',
        kind: 'block',
        required: true,
        example: expect.stringContaining('packningen'),
      }),
    ])
    expect(res.body.footerLines.join('\n')).toContain(
      'Dataskydd och hantering av personuppgifter'
    )
  })

  it('answers 404 for a key the code does not know', async () => {
    const res = await request(app.callback()).get('/system-templates/nope')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('SYSTEM_TEMPLATE_NOT_FOUND')
    expect(getMock).not.toHaveBeenCalled()
  })
})

describe('GET /system-templates', () => {
  it('lists the stored templates', async () => {
    listMock.mockResolvedValue([record])

    const res = await request(app.callback()).get('/system-templates')

    expect(res.status).toBe(200)
    expect(res.body.map((t: { key: string }) => t.key)).toEqual(['work_order'])
  })
})

describe('PUT /system-templates/:key', () => {
  const body = {
    subject: 'Nytt meddelande',
    body: '{{message}}\n\nHälsningar',
    revision: 3,
    updatedBy: 'Per',
  }

  it('saves a valid template at the loaded revision', async () => {
    updateMock.mockResolvedValue({
      ok: true,
      template: { ...record, ...body, revision: 4 },
    })

    const res = await request(app.callback())
      .put('/system-templates/work_order')
      .send(body)

    expect(res.status).toBe(200)
    expect(res.body.revision).toBe(4)
    expect(updateMock).toHaveBeenCalledWith('work_order', body)
  })

  it('rejects a body without the work-order message and saves nothing', async () => {
    const res = await request(app.callback())
      .put('/system-templates/work_order')
      .send({ ...body, body: 'Hej!' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('MISSING_REQUIRED_PLACEHOLDER')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a placeholder the send does not supply', async () => {
    const res = await request(app.callback())
      .put('/system-templates/work_order')
      .send({ ...body, subject: 'Hej {{firstName}}' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('UNKNOWN_PLACEHOLDER')
  })

  it('rejects a subject with a line break', async () => {
    const res = await request(app.callback())
      .put('/system-templates/work_order')
      .send({ ...body, subject: 'Rad 1\nRad 2' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_BODY')
  })

  it('answers 409 TEMPLATE_CHANGED when someone saved in between', async () => {
    updateMock.mockResolvedValue({ ok: false, reason: 'conflict' })

    const res = await request(app.callback())
      .put('/system-templates/work_order')
      .send(body)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('TEMPLATE_CHANGED')
  })
})

describe('POST /system-templates/:key/preview', () => {
  it('renders the finished email with example values', async () => {
    const res = await request(app.callback())
      .post('/system-templates/inspection_protocol/preview')
      .send({ subject: 'Hej {{firstName}}', body: 'Hej **{{firstName}}**!' })

    expect(res.status).toBe(200)
    expect(res.body.subject).toBe('Hej Åsa')
    expect(res.body.html).toMatch(/^<!DOCTYPE html>/)
    expect(res.body.html).toContain('<strong>Åsa</strong>')
    expect(res.body.text).toContain('Hej Åsa!')
  })

  it('reports why an unsaved template would fail', async () => {
    const res = await request(app.callback())
      .post('/system-templates/inspection_protocol/preview')
      .send({ subject: 'Hej', body: '![bild](http://www.mimer.nu/a.png)' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_URL')
  })
})
