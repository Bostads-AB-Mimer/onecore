import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../release-notes'
import * as releaseNotesAdapter from '../../../adapters/communication-adapter/release-notes'

const NOTE_ID = '11111111-1111-1111-1111-111111111111'
const WRITE_ROLE = 'release-notes:write'

const note = {
  id: NOTE_ID,
  app: 'property-tree' as const,
  title: 'Ny funktion',
  description: 'Beskrivning',
  category: 'feature' as const,
  pinned: false,
  publishedAt: new Date('2026-09-29T00:00:00.000Z'),
  createdBy: 'Test User',
  createdAt: new Date('2026-09-29T00:00:00.000Z'),
  updatedAt: new Date('2026-09-29T00:00:00.000Z'),
}

const createBody = {
  app: 'property-tree',
  title: 'Ny funktion',
  description: 'Beskrivning',
  category: 'feature',
}

function appWithUser(roles: string[]) {
  const a = new Koa()
  const r = new KoaRouter()
  a.use(async (ctx, next) => {
    ctx.state.user = {
      id: 'caller-id',
      name: 'Test User',
      realm_access: { roles },
    }
    await next()
  })
  a.use(bodyParser())
  routes(r)
  a.use(r.routes())
  return a
}

beforeEach(jest.restoreAllMocks)

describe('GET /release-notes', () => {
  it('is open to users without the write role and reports canManage false', async () => {
    const listSpy = jest
      .spyOn(releaseNotesAdapter, 'listReleaseNotes')
      .mockResolvedValue({ ok: true, data: [note] })

    const res = await request(appWithUser(['api-access']).callback()).get(
      '/release-notes'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.capabilities).toEqual({ canManage: false })
    expect(listSpy).toHaveBeenCalledWith({
      app: undefined,
      includeDrafts: false,
    })
  })

  it('ignores includeDrafts for users without the write role', async () => {
    const listSpy = jest
      .spyOn(releaseNotesAdapter, 'listReleaseNotes')
      .mockResolvedValue({ ok: true, data: [] })

    await request(appWithUser(['api-access']).callback()).get(
      '/release-notes?includeDrafts=true'
    )

    expect(listSpy).toHaveBeenCalledWith({
      app: undefined,
      includeDrafts: false,
    })
  })

  it('includes drafts for users with the write role', async () => {
    const listSpy = jest
      .spyOn(releaseNotesAdapter, 'listReleaseNotes')
      .mockResolvedValue({ ok: true, data: [] })

    const res = await request(appWithUser([WRITE_ROLE]).callback()).get(
      '/release-notes?includeDrafts=true&app=keys-portal'
    )

    expect(res.body.capabilities).toEqual({ canManage: true })
    expect(listSpy).toHaveBeenCalledWith({
      app: 'keys-portal',
      includeDrafts: true,
    })
  })

  it('returns 400 for an unknown app', async () => {
    const res = await request(appWithUser(['api-access']).callback()).get(
      '/release-notes?app=nope'
    )

    expect(res.status).toBe(400)
  })
})

describe('POST /release-notes', () => {
  it('returns 403 without the write role', async () => {
    const createSpy = jest.spyOn(releaseNotesAdapter, 'createReleaseNote')

    const res = await request(appWithUser(['api-access']).callback())
      .post('/release-notes')
      .send(createBody)

    expect(res.status).toBe(403)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('stamps createdBy from the token, ignoring the body', async () => {
    const createSpy = jest
      .spyOn(releaseNotesAdapter, 'createReleaseNote')
      .mockResolvedValue({ ok: true, data: note })

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .post('/release-notes')
      .send({ ...createBody, createdBy: 'Someone Else' })

    expect(res.status).toBe(201)
    expect(createSpy).toHaveBeenCalledWith({
      ...createBody,
      createdBy: 'Test User',
    })
  })

  it('returns 400 for an invalid body', async () => {
    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .post('/release-notes')
      .send({ ...createBody, title: '' })

    expect(res.status).toBe(400)
  })
})

describe('PUT /release-notes/:id', () => {
  it('returns 403 without the write role', async () => {
    const res = await request(appWithUser(['api-access']).callback())
      .put(`/release-notes/${NOTE_ID}`)
      .send({ title: 'Ny titel' })

    expect(res.status).toBe(403)
  })

  it('forwards the supplied fields', async () => {
    const updateSpy = jest
      .spyOn(releaseNotesAdapter, 'updateReleaseNote')
      .mockResolvedValue({ ok: true, data: note })

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .put(`/release-notes/${NOTE_ID}`)
      .send({ publishedAt: null })

    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalledWith(NOTE_ID, { publishedAt: null })
  })

  it('maps not-found to 404', async () => {
    jest
      .spyOn(releaseNotesAdapter, 'updateReleaseNote')
      .mockResolvedValue({ ok: false, err: 'not-found', statusCode: 404 })

    const res = await request(appWithUser([WRITE_ROLE]).callback())
      .put(`/release-notes/${NOTE_ID}`)
      .send({ title: 'Ny titel' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /release-notes/:id', () => {
  it('returns 403 without the write role', async () => {
    const deleteSpy = jest.spyOn(releaseNotesAdapter, 'deleteReleaseNote')

    const res = await request(appWithUser(['api-access']).callback()).delete(
      `/release-notes/${NOTE_ID}`
    )

    expect(res.status).toBe(403)
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('returns 204 on success', async () => {
    jest
      .spyOn(releaseNotesAdapter, 'deleteReleaseNote')
      .mockResolvedValue({ ok: true, data: null })

    const res = await request(appWithUser([WRITE_ROLE]).callback()).delete(
      `/release-notes/${NOTE_ID}`
    )

    expect(res.status).toBe(204)
  })
})
