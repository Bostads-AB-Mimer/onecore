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
  listReleaseNotes: jest.fn(),
  getReleaseNoteById: jest.fn(),
  createReleaseNote: jest.fn(),
  updateReleaseNote: jest.fn(),
  deleteReleaseNote: jest.fn(),
}))

const listMock = dbAdapter.listReleaseNotes as jest.Mock
const createMock = dbAdapter.createReleaseNote as jest.Mock
const updateMock = dbAdapter.updateReleaseNote as jest.Mock
const deleteMock = dbAdapter.deleteReleaseNote as jest.Mock

const NOTE_ID = '11111111-1111-1111-1111-111111111111'

const note = {
  id: NOTE_ID,
  app: 'property-tree',
  title: 'Ny funktion',
  description: 'Beskrivning',
  category: 'feature',
  pinned: false,
  publishedAt: '2026-09-29T00:00:00.000Z',
  createdBy: 'Test User',
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
}

const app = new Koa()
const router = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => jest.clearAllMocks())

describe('GET /release-notes', () => {
  it('excludes drafts by default', async () => {
    listMock.mockResolvedValue([note])

    const res = await request(app.callback()).get('/release-notes')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([note])
    expect(listMock).toHaveBeenCalledWith({
      app: undefined,
      includeDrafts: false,
    })
  })

  it('passes app and includeDrafts through', async () => {
    listMock.mockResolvedValue([])

    await request(app.callback()).get(
      '/release-notes?app=keys-portal&includeDrafts=true'
    )

    expect(listMock).toHaveBeenCalledWith({
      app: 'keys-portal',
      includeDrafts: true,
    })
  })

  it('returns 400 for an unknown app', async () => {
    const res = await request(app.callback()).get('/release-notes?app=nope')

    expect(res.status).toBe(400)
    expect(listMock).not.toHaveBeenCalled()
  })
})

describe('POST /release-notes', () => {
  const body = {
    app: 'property-tree',
    title: 'Ny funktion',
    description: 'Beskrivning',
    category: 'feature',
    createdBy: 'Test User',
  }

  it('creates a note and returns 201', async () => {
    createMock.mockResolvedValue(note)

    const res = await request(app.callback()).post('/release-notes').send(body)

    expect(res.status).toBe(201)
    expect(createMock).toHaveBeenCalledWith(body)
  })

  it('accepts a note without createdBy', async () => {
    createMock.mockResolvedValue({ ...note, createdBy: null })
    const { createdBy: _createdBy, ...withoutCreatedBy } = body

    const res = await request(app.callback())
      .post('/release-notes')
      .send(withoutCreatedBy)

    expect(res.status).toBe(201)
    expect(createMock).toHaveBeenCalledWith(withoutCreatedBy)
  })

  it('returns 400 for an unknown category', async () => {
    const res = await request(app.callback())
      .post('/release-notes')
      .send({ ...body, category: 'nope' })

    expect(res.status).toBe(400)
  })
})

describe('PUT /release-notes/:id', () => {
  it('updates only the supplied fields', async () => {
    updateMock.mockResolvedValue({ ...note, publishedAt: null })

    const res = await request(app.callback())
      .put(`/release-notes/${NOTE_ID}`)
      .send({ publishedAt: null })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(NOTE_ID, { publishedAt: null })
  })

  it('returns 400 for an empty body', async () => {
    const res = await request(app.callback())
      .put(`/release-notes/${NOTE_ID}`)
      .send({})

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the note does not exist', async () => {
    updateMock.mockResolvedValue(null)

    const res = await request(app.callback())
      .put(`/release-notes/${NOTE_ID}`)
      .send({ title: 'Ny titel' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /release-notes/:id', () => {
  it('returns 200 with the deleted id', async () => {
    deleteMock.mockResolvedValue(true)

    const res = await request(app.callback()).delete(
      `/release-notes/${NOTE_ID}`
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: NOTE_ID })
  })

  it('returns 404 when the note does not exist', async () => {
    deleteMock.mockResolvedValue(false)

    const res = await request(app.callback()).delete(
      `/release-notes/${NOTE_ID}`
    )

    expect(res.status).toBe(404)
  })

  it('returns 404 for a non-uuid id without touching the db', async () => {
    const res = await request(app.callback()).delete('/release-notes/nope')

    expect(res.status).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
