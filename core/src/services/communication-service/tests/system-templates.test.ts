import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { communication } from '@onecore/types'

import { routes } from '../system-templates'
import * as systemTemplatesAdapter from '../../../adapters/communication-adapter/system-templates'

const WRITE_ROLE = 'system-message-templates:write'

const template: communication.SystemTemplate = {
  key: 'inspection_protocol',
  name: 'Besiktningsprotokoll',
  channels: ['email'],
  subject: 'Ditt besiktningsprotokoll',
  body: 'Hej {{firstName}}!',
  revision: 2,
  updatedBy: 'Åsa',
  updatedAt: new Date('2026-11-26T08:00:00.000Z'),
  placeholders: [
    {
      token: 'firstName',
      label: 'Förnamn',
      kind: 'text',
      required: false,
      example: 'Åsa',
    },
  ],
  logoUrl: 'https://www.mimer.nu/logo.png',
  footerLines: ['Bostads AB Mimer'],
}

const update = { subject: 'Nytt', body: 'Hej {{firstName}}', revision: 2 }

function appWithUser(roles: string[]) {
  const a = new Koa()
  const r = new KoaRouter()
  a.use(async (ctx, next) => {
    ctx.state.user = { name: 'Per Persson', realm_access: { roles } }
    await next()
  })
  a.use(bodyParser())
  routes(r)
  a.use(r.routes())
  return a
}

beforeEach(jest.restoreAllMocks)

describe('GET /system-templates', () => {
  it('is open to everyone and says whether the caller may edit', async () => {
    jest
      .spyOn(systemTemplatesAdapter, 'listSystemTemplates')
      .mockResolvedValue({ ok: true, data: [template] })

    const reader = await request(appWithUser(['api-access']).callback()).get(
      '/system-templates'
    )
    const editor = await request(appWithUser([WRITE_ROLE]).callback()).get(
      '/system-templates'
    )

    expect(reader.status).toBe(200)
    expect(reader.body.content).toHaveLength(1)
    expect(reader.body.capabilities).toEqual({ canEdit: false })
    expect(editor.body.capabilities).toEqual({ canEdit: true })
  })
})

describe('GET /system-templates/:key', () => {
  it('forwards 404 from the service', async () => {
    jest.spyOn(systemTemplatesAdapter, 'getSystemTemplate').mockResolvedValue({
      ok: false,
      err: 'SYSTEM_TEMPLATE_NOT_FOUND',
      statusCode: 404,
    })

    const res = await request(appWithUser([]).callback()).get(
      '/system-templates/nope'
    )

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('SYSTEM_TEMPLATE_NOT_FOUND')
  })
})

describe('PUT /system-templates/:key', () => {
  it('is forbidden without the write role and never reaches the service', async () => {
    const spy = jest.spyOn(systemTemplatesAdapter, 'updateSystemTemplate')

    const res = await request(appWithUser(['api-access']).callback())
      .put('/system-templates/inspection_protocol')
      .send(update)

    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })

  it('saves with updatedBy from the token', async () => {
    const spy = jest
      .spyOn(systemTemplatesAdapter, 'updateSystemTemplate')
      .mockResolvedValue({ ok: true, data: { ...template, revision: 3 } })

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .put('/system-templates/inspection_protocol')
      .send({ ...update, updatedBy: 'Någon annan' })

    expect(res.status).toBe(200)
    expect(res.body.content.revision).toBe(3)
    expect(spy).toHaveBeenCalledWith('inspection_protocol', {
      ...update,
      updatedBy: 'Per Persson',
    })
  })

  it.each([
    [400, 'MISSING_REQUIRED_PLACEHOLDER'],
    [409, 'TEMPLATE_CHANGED'],
  ])('forwards %s %s', async (statusCode, err) => {
    jest
      .spyOn(systemTemplatesAdapter, 'updateSystemTemplate')
      .mockResolvedValue({ ok: false, err, statusCode })

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .put('/system-templates/inspection_protocol')
      .send(update)

    expect(res.status).toBe(statusCode)
    expect(res.body.error).toBe(err)
  })

  it('rejects a body without revision before calling the service', async () => {
    const spy = jest.spyOn(systemTemplatesAdapter, 'updateSystemTemplate')

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .put('/system-templates/inspection_protocol')
      .send({ subject: 'Nytt', body: 'Hej' })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('POST /system-templates/:key/preview', () => {
  it('is forbidden without the write role', async () => {
    const spy = jest.spyOn(systemTemplatesAdapter, 'previewSystemTemplate')

    const res = await request(appWithUser(['api-access']).callback())
      .post('/system-templates/inspection_protocol/preview')
      .send({ subject: 'Nytt', body: 'Hej' })

    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns the rendered email', async () => {
    jest
      .spyOn(systemTemplatesAdapter, 'previewSystemTemplate')
      .mockResolvedValue({
        ok: true,
        data: { subject: 'Nytt', html: '<!DOCTYPE html>', text: 'Hej' },
      })

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .post('/system-templates/inspection_protocol/preview')
      .send({ subject: 'Nytt', body: 'Hej' })

    expect(res.status).toBe(200)
    expect(res.body.content.html).toBe('<!DOCTYPE html>')
  })
})
