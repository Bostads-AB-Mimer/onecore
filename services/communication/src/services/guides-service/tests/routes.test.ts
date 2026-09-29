import { randomUUID } from 'crypto'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'
import request from 'supertest'
import { guides } from '@onecore/types'

import * as categoriesAdapter from '../adapters/categories-adapter'
import * as guidesAdapter from '../adapters/guides-adapter'
import * as imagesAdapter from '../adapters/images-adapter'
import {
  AltTextRequiredError,
  CategoryNotFoundError,
  GuideModifiedError,
  ImageNotInStepError,
  SlugTakenError,
  StepBelongsToOtherGuideError,
} from '../errors'
import { routes } from '../index'
import * as factory from './factories'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

// Route tests assert HTTP behaviour only; the adapter tests cover the DB.
jest.mock('../../../common/db', () => ({ db: {} }))

const app = new Koa()
const okapi = makeOkapiRouter(new KoaRouter())
routes(okapi)
app.use(bodyParser())
app.use(okapi.routes())

const now = new Date()
const category: guides.GuideCategory = {
  id: randomUUID(),
  name: 'Tenfast',
  createdAt: now,
  updatedAt: now,
}
const guide: guides.Guide = {
  id: randomUUID(),
  slug: 'registrera-uppsagning',
  title: 'Registrera uppsägning',
  description: '',
  status: 'published',
  category,
  stepCount: 1,
  createdBy: 'Anna',
  updatedBy: 'Anna',
  publishedAt: now,
  createdAt: now,
  updatedAt: now,
  steps: [
    {
      id: randomUUID(),
      guideId: 'g',
      sortOrder: 0,
      title: 'Step',
      body: '<p>Body</p>',
      calloutType: null,
      calloutText: null,
      images: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
}

afterEach(() => jest.restoreAllMocks())

// PUT payload: a guide write plus the concurrency token.
const updateBody = () => ({
  ...factory.guideWrite.build(),
  expectedUpdatedAt: now.toISOString(),
})

describe('GET /guides', () => {
  it('passes includeDrafts through as a boolean', async () => {
    const spy = jest.spyOn(guidesAdapter, 'listGuides').mockResolvedValue([])

    const res = await request(app.callback()).get('/guides?includeDrafts=true')

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith({ includeDrafts: true }, {})
  })

  it('defaults includeDrafts to false', async () => {
    const spy = jest.spyOn(guidesAdapter, 'listGuides').mockResolvedValue([])

    await request(app.callback()).get('/guides')

    expect(spy).toHaveBeenCalledWith({ includeDrafts: false }, {})
  })

  it('rejects an invalid includeDrafts value', async () => {
    const res = await request(app.callback()).get('/guides?includeDrafts=yes')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('rejects a repeated includeDrafts parameter', async () => {
    const res = await request(app.callback()).get(
      '/guides?includeDrafts=true&includeDrafts=false'
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('hides the underlying error on an unexpected failure', async () => {
    jest
      .spyOn(guidesAdapter, 'listGuides')
      .mockRejectedValue(new Error('SELECT * FROM guide -- connection lost'))

    const res = await request(app.callback()).get('/guides')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'internal-server-error' })
  })
})

describe('GET /guides/categories', () => {
  it('lists categories', async () => {
    jest
      .spyOn(categoriesAdapter, 'listCategories')
      .mockResolvedValue([category])

    const res = await request(app.callback()).get('/guides/categories')

    expect(res.status).toBe(200)
    expect(res.body[0].name).toBe('Tenfast')
  })
})

describe('GET /guides/by-slug/:slug', () => {
  it('returns the guide', async () => {
    jest.spyOn(guidesAdapter, 'getGuideBySlug').mockResolvedValue(guide)

    const res = await request(app.callback()).get(
      '/guides/by-slug/registrera-uppsagning'
    )

    expect(res.status).toBe(200)
    expect(res.body.slug).toBe('registrera-uppsagning')
  })

  it('returns 404 for an unknown slug', async () => {
    jest.spyOn(guidesAdapter, 'getGuideBySlug').mockResolvedValue(null)

    const res = await request(app.callback()).get('/guides/by-slug/nope')

    expect(res.status).toBe(404)
  })

  it('returns 404 without hitting the database on a malformed slug', async () => {
    const spy = jest.spyOn(guidesAdapter, 'getGuideBySlug')

    const res = await request(app.callback()).get('/guides/by-slug/Not_A_Slug')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not-found' })
    expect(spy).not.toHaveBeenCalled()
  })
})

// An id that cannot name a row is answered as a missing resource, and the
// adapter is never called with it.
describe('path parameter validation', () => {
  it.each([
    ['get', '/guides/not-a-uuid'],
    ['put', '/guides/not-a-uuid'],
    ['delete', '/guides/not-a-uuid'],
    ['post', `/guides/${randomUUID()}/steps/not-a-uuid/images`],
    ['post', '/guides/not-a-uuid/steps/not-a-uuid/images'],
    ['delete', `/guides/${randomUUID()}/images/not-a-uuid`],
  ] as const)('answers 404 for %s %s', async (method, path) => {
    const spies = [
      jest.spyOn(guidesAdapter, 'getGuideById'),
      jest.spyOn(guidesAdapter, 'updateGuide'),
      jest.spyOn(guidesAdapter, 'deleteGuide'),
      jest.spyOn(imagesAdapter, 'createStepImage'),
      jest.spyOn(imagesAdapter, 'deleteStepImage'),
    ]

    const res = await request(app.callback())[method](path).send({})

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not-found' })
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  })
})

describe('POST /guides', () => {
  it('sanitizes step bodies before creating', async () => {
    const spy = jest
      .spyOn(guidesAdapter, 'createGuide')
      .mockResolvedValue(guide)
    const input = factory.guideWrite.build({
      steps: [factory.step.build({ body: '<p>ok</p><script>x()</script>' })],
    })

    const res = await request(app.callback()).post('/guides').send(input)

    expect(res.status).toBe(200)
    expect(spy.mock.calls[0][0].steps[0].body).toBe('<p>ok</p>')
  })

  it('returns 400 with issues on an invalid payload', async () => {
    const res = await request(app.callback())
      .post('/guides')
      .send({ title: '', slug: 'Not A Slug' })

    expect(res.status).toBe(400)
    expect(res.body.issues.length).toBeGreaterThan(0)
  })

  it.each([
    ['category name', { category: { name: '   ' } }, ['category']],
    ['title', { title: '   ' }, ['title']],
  ])(
    'returns 400 when the %s is only whitespace',
    async (_field, override, path) => {
      const spy = jest.spyOn(guidesAdapter, 'createGuide')

      const res = await request(app.callback())
        .post('/guides')
        .send(factory.guideWrite.build(override))

      expect(res.status).toBe(400)
      expect(res.body.issues).toContainEqual(
        expect.objectContaining({ path: expect.arrayContaining(path) })
      )
      expect(spy).not.toHaveBeenCalled()
    }
  )

  it('trims the category name, title and step titles before creating', async () => {
    const spy = jest
      .spyOn(guidesAdapter, 'createGuide')
      .mockResolvedValue(guide)
    const input = factory.guideWrite.build({
      title: '  Registrera uppsägning  ',
      category: { name: '  Tenfast  ' },
      steps: [factory.step.build({ title: '  Step  ' })],
    })

    const res = await request(app.callback()).post('/guides').send(input)

    expect(res.status).toBe(200)
    const saved = spy.mock.calls[0][0]
    expect(saved.category).toEqual({ name: 'Tenfast' })
    expect(saved.title).toBe('Registrera uppsägning')
    expect(saved.steps[0].title).toBe('Step')
  })

  it('returns 400 when publishing without steps', async () => {
    const res = await request(app.callback())
      .post('/guides')
      .send(factory.guideWrite.build({ status: 'published', steps: [] }))

    expect(res.status).toBe(400)
    expect(res.body.issues[0].path).toEqual(['steps'])
  })

  it('returns 400 when the same step id appears twice', async () => {
    const step = factory.step.build()
    const res = await request(app.callback())
      .post('/guides')
      .send(factory.guideWrite.build({ steps: [step, { ...step }] }))

    expect(res.status).toBe(400)
    expect(res.body.issues).toContainEqual({
      path: ['steps', 1, 'id'],
      message: 'Step ids must be unique',
    })
  })

  it('returns 400 when the same image id appears twice', async () => {
    const image = {
      id: randomUUID(),
      sortOrder: 0,
      altText: 'Alt',
      caption: null,
    }
    const res = await request(app.callback())
      .post('/guides')
      .send(
        factory.guideWrite.build({
          steps: [
            factory.step.build({ images: [image] }),
            factory.step.build({ images: [image] }),
          ],
        })
      )

    expect(res.status).toBe(400)
    expect(res.body.issues).toContainEqual({
      path: ['steps', 1, 'images', 0, 'id'],
      message: 'Image ids must be unique',
    })
  })

  it('returns 400 when publishing an image without alt text', async () => {
    const res = await request(app.callback())
      .post('/guides')
      .send(
        factory.guideWrite.build({
          status: 'published',
          steps: [
            factory.step.build({
              images: [
                {
                  id: randomUUID(),
                  sortOrder: 0,
                  altText: '   ',
                  caption: null,
                },
              ],
            }),
          ],
        })
      )

    expect(res.status).toBe(400)
    expect(res.body.issues).toContainEqual({
      path: ['steps', 0, 'images', 0, 'altText'],
      message: 'Alt text is required for published guides',
    })
  })

  it('returns 409 when the slug is taken', async () => {
    jest
      .spyOn(guidesAdapter, 'createGuide')
      .mockRejectedValue(new SlugTakenError('taken'))

    const res = await request(app.callback())
      .post('/guides')
      .send(factory.guideWrite.build())

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('slug-taken')
  })
})

describe('PUT /guides/:id', () => {
  it('returns the guide and removed storage keys', async () => {
    jest.spyOn(guidesAdapter, 'updateGuide').mockResolvedValue({
      guide,
      removedStorageKeys: ['guide/x/1.png'],
    })

    const res = await request(app.callback())
      .put(`/guides/${guide.id}`)
      .send(updateBody())

    expect(res.status).toBe(200)
    expect(res.body.removedStorageKeys).toEqual(['guide/x/1.png'])
  })

  it('passes expectedUpdatedAt through to the adapter', async () => {
    const spy = jest
      .spyOn(guidesAdapter, 'updateGuide')
      .mockResolvedValue({ guide, removedStorageKeys: [] })
    const body = updateBody()

    await request(app.callback()).put(`/guides/${guide.id}`).send(body)

    expect(spy).toHaveBeenCalledWith(
      guide.id,
      expect.objectContaining({ expectedUpdatedAt: body.expectedUpdatedAt }),
      expect.anything()
    )
  })

  it.each([
    ['missing', undefined],
    ['not a datetime', 'yesterday'],
  ])(
    'returns 400 when expectedUpdatedAt is %s',
    async (_label, expectedUpdatedAt) => {
      const spy = jest.spyOn(guidesAdapter, 'updateGuide')

      const res = await request(app.callback())
        .put(`/guides/${guide.id}`)
        .send({ ...factory.guideWrite.build(), expectedUpdatedAt })

      expect(res.status).toBe(400)
      expect(spy).not.toHaveBeenCalled()
    }
  )

  it('returns 404 for an unknown guide', async () => {
    jest.spyOn(guidesAdapter, 'updateGuide').mockResolvedValue(null)

    const res = await request(app.callback())
      .put(`/guides/${randomUUID()}`)
      .send(updateBody())

    expect(res.status).toBe(404)
  })

  it.each([
    [409, 'slug-taken', new SlugTakenError('taken')],
    [409, 'guide-modified', new GuideModifiedError(randomUUID())],
    [400, 'category-not-found', new CategoryNotFoundError(randomUUID())],
    [
      400,
      'image-not-in-step',
      new ImageNotInStepError(randomUUID(), randomUUID()),
    ],
    [
      400,
      'step-belongs-to-other-guide',
      new StepBelongsToOtherGuideError(randomUUID()),
    ],
  ])('maps an adapter rejection to %s %s', async (status, error, rejection) => {
    jest.spyOn(guidesAdapter, 'updateGuide').mockRejectedValue(rejection)

    const res = await request(app.callback())
      .put(`/guides/${guide.id}`)
      .send(updateBody())

    expect(res.status).toBe(status)
    expect(res.body).toEqual({ error })
  })
})

describe('DELETE /guides/:id', () => {
  it('returns the storage keys of the deleted guide', async () => {
    jest
      .spyOn(guidesAdapter, 'deleteGuide')
      .mockResolvedValue({ storageKeys: ['a', 'b'] })

    const res = await request(app.callback()).delete(`/guides/${guide.id}`)

    expect(res.status).toBe(200)
    expect(res.body.storageKeys).toEqual(['a', 'b'])
  })

  it('returns 404 for an unknown guide', async () => {
    jest.spyOn(guidesAdapter, 'deleteGuide').mockResolvedValue(null)

    const res = await request(app.callback()).delete(`/guides/${randomUUID()}`)

    expect(res.status).toBe(404)
  })
})

describe('step images', () => {
  it('creates image metadata', async () => {
    const image: guides.GuideStepImage = {
      id: randomUUID(),
      stepId: guide.steps[0].id,
      sortOrder: 0,
      storageKey: 'guide/x/1.png',
      filename: '1.png',
      contentType: 'image/png',
      altText: '',
      caption: null,
      createdAt: now,
    }
    jest
      .spyOn(imagesAdapter, 'createStepImage')
      .mockResolvedValue({ image, guideUpdatedAt: now })

    const res = await request(app.callback())
      .post(`/guides/${guide.id}/steps/${guide.steps[0].id}/images`)
      .send({
        id: image.id,
        storageKey: image.storageKey,
        filename: image.filename,
        contentType: image.contentType,
      })

    expect(res.status).toBe(200)
    expect(res.body.image.storageKey).toBe('guide/x/1.png')
    expect(res.body.guideUpdatedAt).toBe(now.toISOString())
  })

  it('maps a missing alt text on a published guide to 400 alt-text-required', async () => {
    jest
      .spyOn(imagesAdapter, 'createStepImage')
      .mockRejectedValue(new AltTextRequiredError(guide.id))

    const res = await request(app.callback())
      .post(`/guides/${guide.id}/steps/${guide.steps[0].id}/images`)
      .send({
        id: randomUUID(),
        storageKey: 'guide/x/1.png',
        filename: '1.png',
        contentType: 'image/png',
      })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'alt-text-required' })
  })

  it('returns 404 when the step is not on the guide', async () => {
    jest.spyOn(imagesAdapter, 'createStepImage').mockResolvedValue(null)

    const res = await request(app.callback())
      .post(`/guides/${guide.id}/steps/${randomUUID()}/images`)
      .send({
        id: randomUUID(),
        storageKey: 'k',
        filename: 'f.png',
        contentType: 'image/png',
      })

    expect(res.status).toBe(404)
  })

  it('deletes an image and returns its storage key', async () => {
    jest
      .spyOn(imagesAdapter, 'deleteStepImage')
      .mockResolvedValue({ storageKey: 'guide/x/1.png', guideUpdatedAt: now })

    const res = await request(app.callback()).delete(
      `/guides/${guide.id}/images/${randomUUID()}`
    )

    expect(res.status).toBe(200)
    expect(res.body.storageKey).toBe('guide/x/1.png')
    expect(res.body.guideUpdatedAt).toBe(now.toISOString())
  })
})
