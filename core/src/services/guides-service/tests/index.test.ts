import { randomUUID } from 'crypto'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import request from 'supertest'
import { guides } from '@onecore/types'

import * as communicationAdapter from '../../../adapters/communication-adapter'
import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
import { routes } from '../index'

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  generateRouteMetadata: jest.fn(() => ({})),
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser({ jsonLimit: '50mb' }))
// Simulate the Keycloak token: roles arrive in the x-roles header.
app.use(async (ctx, next) => {
  const roles = String(ctx.get('x-roles') || '')
    .split(',')
    .filter(Boolean)
  ctx.state.user = { name: 'Anna', realm_access: { roles } }
  await next()
})
app.use(router.routes())

const asAdmin = { 'x-roles': 'api-access,guides-admin' }
const asReader = { 'x-roles': 'api-access' }

const now = new Date()
const stepId = randomUUID()
const guide: guides.Guide = {
  id: randomUUID(),
  slug: 'registrera-uppsagning',
  title: 'Registrera uppsägning',
  description: '',
  status: 'published',
  category: {
    id: randomUUID(),
    name: 'Tenfast',
    createdAt: now,
    updatedAt: now,
  },
  stepCount: 1,
  createdBy: 'Anna',
  updatedBy: 'Anna',
  publishedAt: now,
  createdAt: now,
  updatedAt: now,
  steps: [
    {
      id: stepId,
      guideId: 'g',
      sortOrder: 0,
      title: 'Step',
      body: '<p>Body</p>',
      calloutType: null,
      calloutText: null,
      images: [
        {
          id: randomUUID(),
          stepId,
          sortOrder: 0,
          storageKey: 'guide/g/1.png',
          filename: '1.png',
          contentType: 'image/png',
          altText: 'Dialog',
          caption: null,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ],
}

const writeBody = (): guides.CreateGuideRequest => ({
  title: 'Ny guide',
  description: '',
  slug: 'ny-guide',
  category: { name: 'Tenfast' },
  status: 'draft',
  steps: [{ id: randomUUID(), title: 'Steg 1', body: '<p>x</p>', images: [] }],
})

beforeEach(() => {
  jest.restoreAllMocks()
  jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
    ok: true,
    data: { url: 'https://minio/x', expiresIn: 1 },
  })
})

describe('GET /guides', () => {
  it('lets admins include drafts', async () => {
    const spy = jest
      .spyOn(communicationAdapter.guides, 'listGuides')
      .mockResolvedValue({ ok: true, data: [] })

    await request(app.callback()).get('/guides?includeDrafts=true').set(asAdmin)

    expect(spy).toHaveBeenCalledWith({ includeDrafts: true })
  })

  it('ignores includeDrafts for readers', async () => {
    const spy = jest
      .spyOn(communicationAdapter.guides, 'listGuides')
      .mockResolvedValue({ ok: true, data: [] })

    await request(app.callback())
      .get('/guides?includeDrafts=true')
      .set(asReader)

    expect(spy).toHaveBeenCalledWith({ includeDrafts: false })
  })

  it('rejects an includeDrafts value that is not true or false', async () => {
    const spy = jest.spyOn(communicationAdapter.guides, 'listGuides')

    const res = await request(app.callback())
      .get('/guides?includeDrafts=1')
      .set(asAdmin)

    expect(res.status).toBe(400)
    expect(res.body.issues[0].path).toEqual(['includeDrafts'])
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('GET /guides/by-slug/:slug', () => {
  it('enriches images with presigned urls', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'getGuideBySlug')
      .mockResolvedValue({ ok: true, data: guide })

    const res = await request(app.callback())
      .get('/guides/by-slug/registrera-uppsagning')
      .set(asReader)

    expect(res.status).toBe(200)
    expect(res.body.content.steps[0].images[0].url).toBe('https://minio/x')
    expect(fileStorageAdapter.getFileUrl).toHaveBeenCalledWith(
      'guide/g/1.png',
      24 * 60 * 60
    )
  })

  it('masks drafts for readers but not for admins', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'getGuideBySlug')
      .mockResolvedValue({ ok: true, data: { ...guide, status: 'draft' } })

    const reader = await request(app.callback())
      .get('/guides/by-slug/registrera-uppsagning')
      .set(asReader)
    expect(reader.status).toBe(200)
    expect(reader.body.content).toEqual({
      slug: 'registrera-uppsagning',
      title: 'Registrera uppsägning',
      unpublished: true,
    })

    const admin = await request(app.callback())
      .get('/guides/by-slug/registrera-uppsagning')
      .set(asAdmin)
    expect(admin.body.content.steps).toHaveLength(1)
  })

  it('keeps redirectedFrom when an old slug resolved', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'getGuideBySlug')
      .mockResolvedValue({
        ok: true,
        data: { ...guide, redirectedFrom: 'gammal-slug' },
      })

    const res = await request(app.callback())
      .get('/guides/by-slug/gammal-slug')
      .set(asReader)

    expect(res.status).toBe(200)
    expect(res.body.content.redirectedFrom).toBe('gammal-slug')
  })

  it('returns an empty url when the file is missing in storage', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'getGuideBySlug')
      .mockResolvedValue({ ok: true, data: guide })
    jest
      .spyOn(fileStorageAdapter, 'getFileUrl')
      .mockResolvedValue({ ok: false, err: 'not_found' })

    const res = await request(app.callback())
      .get('/guides/by-slug/registrera-uppsagning')
      .set(asReader)

    expect(res.status).toBe(200)
    expect(res.body.content.steps[0].images[0].url).toBe('')
  })

  it('returns 404 when the guide does not exist', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'getGuideBySlug')
      .mockResolvedValue({ ok: false, err: 'not-found' })

    const res = await request(app.callback())
      .get('/guides/by-slug/nope')
      .set(asReader)

    expect(res.status).toBe(404)
  })
})

describe('GET /guides/:id', () => {
  it('hides a draft from readers but returns it to admins', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'getGuideById')
      .mockResolvedValue({ ok: true, data: { ...guide, status: 'draft' } })

    const reader = await request(app.callback())
      .get(`/guides/${guide.id}`)
      .set(asReader)
    expect(reader.status).toBe(403)

    const admin = await request(app.callback())
      .get(`/guides/${guide.id}`)
      .set(asAdmin)
    expect(admin.status).toBe(200)
    expect(admin.body.content.steps).toHaveLength(1)
  })

  it('returns 404 for an id that is not a uuid, without calling communication', async () => {
    const spy = jest.spyOn(communicationAdapter.guides, 'getGuideById')

    const res = await request(app.callback())
      .get('/guides/not-a-uuid')
      .set(asAdmin)

    expect(res.status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('POST /guides', () => {
  it('adds the acting user as author', async () => {
    const spy = jest
      .spyOn(communicationAdapter.guides, 'createGuide')
      .mockResolvedValue({ ok: true, data: guide })

    const res = await request(app.callback())
      .post('/guides')
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(200)
    expect(spy.mock.calls[0][0].author).toBe('Anna')
  })

  it('returns 400 with issues on invalid input', async () => {
    const res = await request(app.callback())
      .post('/guides')
      .set(asAdmin)
      .send({ ...writeBody(), slug: 'Bad Slug' })

    expect(res.status).toBe(400)
    expect(res.body.issues[0].path).toEqual(['slug'])
  })

  it('proxies the reason for a bad request from communication', async () => {
    jest.spyOn(communicationAdapter.guides, 'createGuide').mockResolvedValue({
      ok: false,
      err: 'bad-request',
      upstream: { error: 'category-not-found' },
    })

    const res = await request(app.callback())
      .post('/guides')
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('category-not-found')
  })

  it('maps a slug conflict to 409', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'createGuide')
      .mockResolvedValue({ ok: false, err: 'conflict' })

    const res = await request(app.callback())
      .post('/guides')
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('slug-taken')
  })
})

describe('PUT /guides/:id', () => {
  it('deletes files for images removed by the save', async () => {
    jest.spyOn(communicationAdapter.guides, 'updateGuide').mockResolvedValue({
      ok: true,
      data: { guide, removedStorageKeys: ['guide/g/old.png'] },
    })
    const deleteSpy = jest
      .spyOn(fileStorageAdapter, 'deleteFile')
      .mockResolvedValue({ ok: true, data: undefined })

    const res = await request(app.callback())
      .put(`/guides/${guide.id}`)
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(200)
    expect(deleteSpy).toHaveBeenCalledWith('guide/g/old.png')
  })

  it('maps a missing guide to 404', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'updateGuide')
      .mockResolvedValue({ ok: false, err: 'not-found' })

    const res = await request(app.callback())
      .put(`/guides/${guide.id}`)
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(404)
  })

  it('maps a slug conflict to 409', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'updateGuide')
      .mockResolvedValue({ ok: false, err: 'conflict' })

    const res = await request(app.callback())
      .put(`/guides/${guide.id}`)
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('slug-taken')
  })

  it('proxies the error code and issues from a bad request', async () => {
    jest.spyOn(communicationAdapter.guides, 'updateGuide').mockResolvedValue({
      ok: false,
      err: 'bad-request',
      upstream: {
        error: 'image-not-in-step',
        issues: [{ path: ['steps', 0], message: 'Unknown image' }],
      },
    })

    const res = await request(app.callback())
      .put(`/guides/${guide.id}`)
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('image-not-in-step')
    expect(res.body.issues).toEqual([
      { path: ['steps', 0], message: 'Unknown image' },
    ])
  })

  it('returns 404 for an id that is not a uuid, without calling communication', async () => {
    const spy = jest.spyOn(communicationAdapter.guides, 'updateGuide')

    const res = await request(app.callback())
      .put('/guides/not-a-uuid')
      .set(asAdmin)
      .send(writeBody())

    expect(res.status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('DELETE /guides/:id', () => {
  it('deletes the image files of the removed guide', async () => {
    jest.spyOn(communicationAdapter.guides, 'deleteGuide').mockResolvedValue({
      ok: true,
      data: { storageKeys: ['guide/g/1.png', 'guide/g/2.png'] },
    })
    const deleteSpy = jest
      .spyOn(fileStorageAdapter, 'deleteFile')
      .mockResolvedValue({ ok: true, data: undefined })

    const res = await request(app.callback())
      .delete(`/guides/${guide.id}`)
      .set(asAdmin)

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ deleted: true })
    expect(deleteSpy.mock.calls.map(([key]) => key)).toEqual([
      'guide/g/1.png',
      'guide/g/2.png',
    ])
  })

  it('returns 404 for an id that is not a uuid, without calling communication', async () => {
    const spy = jest.spyOn(communicationAdapter.guides, 'deleteGuide')

    const res = await request(app.callback())
      .delete('/guides/not-a-uuid')
      .set(asAdmin)

    expect(res.status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('POST /guides/:id/steps/:stepId/images', () => {
  const upload = (body: Record<string, unknown>) =>
    request(app.callback())
      .post(`/guides/${guide.id}/steps/${stepId}/images`)
      .set(asAdmin)
      .send(body)

  // Minimal file whose leading bytes identify it as a PNG.
  const pngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('payload'),
  ])
  const png = pngBuffer.toString('base64')

  it('rejects unsupported content types', async () => {
    const res = await upload({
      fileName: 'x.gif',
      fileData: png,
      contentType: 'image/gif',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-file-type')
  })

  it('rejects an oversized payload without decoding it', async () => {
    const uploadSpy = jest.spyOn(fileStorageAdapter, 'uploadFile')
    const big = 'A'.repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 5)

    const res = await upload({
      fileName: 'x.png',
      fileData: big,
      contentType: 'image/png',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-file-size')
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('rejects base64 with a data: prefix or invalid characters', async () => {
    const withPrefix = await upload({
      fileName: 'x.png',
      fileData: `data:image/png;base64,${png}`,
      contentType: 'image/png',
    })
    expect(withPrefix.status).toBe(400)
    expect(withPrefix.body.error).toBe('invalid-file-data')

    const withWhitespace = await upload({
      fileName: 'x.png',
      fileData: `${png.slice(0, 4)} ${png.slice(4)}`,
      contentType: 'image/png',
    })
    expect(withWhitespace.status).toBe(400)
    expect(withWhitespace.body.error).toBe('invalid-file-data')
  })

  it('rejects a file whose magic bytes do not match the content type', async () => {
    const uploadSpy = jest.spyOn(fileStorageAdapter, 'uploadFile')

    const res = await upload({
      fileName: 'x.png',
      fileData: Buffer.from('<html>not an image</html>').toString('base64'),
      contentType: 'image/png',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-file-type')
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('returns 500 and records nothing when the storage upload fails', async () => {
    jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    const createSpy = jest.spyOn(communicationAdapter.guides, 'createStepImage')

    const res = await upload({
      fileName: 'x.png',
      fileData: png,
      contentType: 'image/png',
    })

    expect(res.status).toBe(500)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('maps a bad_request from storage to 400', async () => {
    jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: false, err: 'bad_request' })

    const res = await upload({
      fileName: 'x.png',
      fileData: png,
      contentType: 'image/png',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-file-data')
  })

  it('returns 404 for a step id that is not a uuid, without calling communication', async () => {
    const createSpy = jest.spyOn(communicationAdapter.guides, 'createStepImage')

    const res = await request(app.callback())
      .post(`/guides/${guide.id}/steps/not-a-uuid/images`)
      .set(asAdmin)
      .send({ fileName: 'x.png', fileData: png, contentType: 'image/png' })

    expect(res.status).toBe(404)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('uploads under guide/{id}/ and records the metadata', async () => {
    const uploadSpy = jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: true, data: { fileName: 'k', message: '' } })
    const createSpy = jest
      .spyOn(communicationAdapter.guides, 'createStepImage')
      .mockResolvedValue({ ok: true, data: guide.steps[0].images[0] })

    const res = await upload({
      fileName: 'screenshot.png',
      fileData: png,
      contentType: 'image/png',
      altText: 'Dialog',
    })

    expect(res.status).toBe(200)
    expect(uploadSpy.mock.calls[0][0]).toMatch(
      new RegExp(`^guide/${guide.id}/[0-9a-f-]{36}\\.png$`)
    )
    expect(createSpy.mock.calls[0][2]).toMatchObject({
      filename: 'screenshot.png',
      contentType: 'image/png',
      altText: 'Dialog',
    })
    expect(res.body.content.url).toBe('https://minio/x')
  })

  it('proxies a bad-request from communication as 400 with its error body', async () => {
    jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: true, data: { fileName: 'k', message: '' } })
    jest
      .spyOn(communicationAdapter.guides, 'createStepImage')
      .mockResolvedValue({
        ok: false,
        err: 'bad-request',
        upstream: { error: 'image-not-in-step' },
      })
    const deleteSpy = jest
      .spyOn(fileStorageAdapter, 'deleteFile')
      .mockResolvedValue({ ok: true, data: undefined })

    const res = await upload({
      fileName: 'x.png',
      fileData: png,
      contentType: 'image/png',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('image-not-in-step')
    // The file is still compensated away when the metadata write is rejected.
    expect(deleteSpy).toHaveBeenCalledTimes(1)
  })

  it('deletes the uploaded file when the metadata write fails', async () => {
    jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: true, data: { fileName: 'k', message: '' } })
    jest
      .spyOn(communicationAdapter.guides, 'createStepImage')
      .mockResolvedValue({ ok: false, err: 'not-found' })
    const deleteSpy = jest
      .spyOn(fileStorageAdapter, 'deleteFile')
      .mockResolvedValue({ ok: true, data: undefined })

    const res = await upload({
      fileName: 'x.png',
      fileData: png,
      contentType: 'image/png',
    })

    expect(res.status).toBe(404)
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy.mock.calls[0][0]).toMatch(/^guide\//)
  })
})

describe('DELETE /guides/:id/images/:imageId', () => {
  it('removes the row and then the file', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'deleteStepImage')
      .mockResolvedValue({ ok: true, data: { storageKey: 'guide/g/1.png' } })
    const deleteSpy = jest
      .spyOn(fileStorageAdapter, 'deleteFile')
      .mockResolvedValue({ ok: true, data: undefined })

    const res = await request(app.callback())
      .delete(`/guides/${guide.id}/images/${randomUUID()}`)
      .set(asAdmin)

    expect(res.status).toBe(200)
    expect(deleteSpy).toHaveBeenCalledWith('guide/g/1.png')
  })
})
