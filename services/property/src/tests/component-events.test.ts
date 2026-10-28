jest.mock('../adapters/db', () => ({
  prisma: {
    components: {
      count: jest.fn(),
    },
    componentEvents: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'
import { logger } from '@onecore/utilities'
import { prisma } from '../adapters/db'
import { routes as componentRoutes } from '../routes/component-instances'

const componentId = 'aaaaaaaa-1111-4111-8111-111111111111'
const otherComponentId = 'bbbbbbbb-2222-4222-8222-222222222222'

const eventRow = (overrides: Record<string, unknown> = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  componentId,
  eventType: 'REPAIRED',
  occurredAt: new Date('2026-10-28T00:00:00.000Z'),
  sourceType: 'WORK_ORDER',
  sourceId: 'od-123',
  relatedComponentId: null,
  actor: 'jdoe',
  note: 'Bytte packning',
  createdAt: new Date('2026-10-28T09:15:00.000Z'),
  ...overrides,
})

const validBody = {
  eventType: 'REPAIRED',
  occurredAt: '2026-10-28',
  sourceType: 'WORK_ORDER',
  sourceId: 'od-123',
  actor: 'jdoe',
  note: 'Bytte packning',
}

const app = new Koa()
const router = new KoaRouter()
componentRoutes(router)
app.use(bodyParser())
app.use(router.routes())

const componentCount = prisma.components.count as jest.Mock
const findFirst = prisma.componentEvents.findFirst as jest.Mock
const findMany = prisma.componentEvents.findMany as jest.Mock
const create = prisma.componentEvents.create as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
  componentCount.mockResolvedValue(1)
})

describe('POST /components/:id/events', () => {
  const post = (body: object, id = componentId) =>
    request(app.callback()).post(`/components/${id}/events`).send(body)

  it('creates the event and returns 201 with a date-only occurredAt', async () => {
    findFirst.mockResolvedValueOnce(null)
    create.mockResolvedValueOnce(eventRow())

    const res = await post(validBody)

    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      componentId,
      eventType: 'REPAIRED',
      occurredAt: '2026-10-28',
      sourceId: 'od-123',
      createdAt: '2026-10-28T09:15:00.000Z',
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        componentId,
        occurredAt: new Date('2026-10-28'),
        relatedComponentId: null,
      }),
    })
  })

  it('returns the stored event with 200 and writes nothing when the event already exists', async () => {
    findFirst.mockResolvedValueOnce(eventRow())

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body.content.id).toBe(eventRow().id)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        componentId,
        eventType: 'REPAIRED',
        sourceType: 'WORK_ORDER',
        sourceId: 'od-123',
      },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('returns the stored event with 200 when a concurrent insert wins the unique index', async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(eventRow())
    create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    )

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body.content.id).toBe(eventRow().id)
  })

  it('always creates a MANUAL event without sourceId', async () => {
    create.mockResolvedValueOnce(
      eventRow({ sourceType: 'MANUAL', sourceId: null })
    )

    const res = await post({
      eventType: 'REPAIRED',
      occurredAt: '2026-10-28',
      sourceType: 'MANUAL',
      actor: 'jdoe',
    })

    expect(res.status).toBe(201)
    expect(findFirst).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceId: null, note: null }),
    })
  })

  it('returns 404 when the component does not exist', async () => {
    componentCount.mockResolvedValueOnce(0)

    const res = await post(validBody)

    expect(res.status).toBe(404)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns 404 when the component is deleted before the insert', async () => {
    findFirst.mockResolvedValueOnce(null)
    create.mockRejectedValueOnce(
      Object.assign(new Error('FK_component_events_component'), {
        code: 'P2003',
      })
    )

    const res = await post(validBody)

    expect(res.status).toBe(404)
  })

  it('stores a relatedComponentId that exists', async () => {
    findFirst.mockResolvedValueOnce(null)
    create.mockResolvedValueOnce(
      eventRow({ relatedComponentId: otherComponentId })
    )

    const res = await post({
      ...validBody,
      relatedComponentId: otherComponentId,
    })

    expect(res.status).toBe(201)
    expect(res.body.content.relatedComponentId).toBe(otherComponentId)
    expect(componentCount).toHaveBeenNthCalledWith(2, {
      where: { id: otherComponentId },
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ relatedComponentId: otherComponentId }),
    })
  })

  it('returns 400 when relatedComponentId does not exist', async () => {
    componentCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0)

    const res = await post({
      ...validBody,
      relatedComponentId: otherComponentId,
    })

    expect(res.status).toBe(400)
    expect(componentCount).toHaveBeenNthCalledWith(2, {
      where: { id: otherComponentId },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('accepts null for note and relatedComponentId', async () => {
    findFirst.mockResolvedValueOnce(null)
    create.mockResolvedValueOnce(eventRow({ note: null }))

    const res = await post({
      ...validBody,
      note: null,
      relatedComponentId: null,
    })

    expect(res.status).toBe(201)
    expect(componentCount).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: null, relatedComponentId: null }),
    })
  })

  it('returns the stored event on a retry even if the related component is gone', async () => {
    findFirst.mockResolvedValueOnce(
      eventRow({ relatedComponentId: otherComponentId })
    )
    componentCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0)

    const res = await post({
      ...validBody,
      relatedComponentId: otherComponentId,
    })

    expect(res.status).toBe(200)
    expect(componentCount).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
  })

  it('warns when a repeated event differs from the stored one', async () => {
    const warn = jest.spyOn(logger, 'warn')
    findFirst.mockResolvedValueOnce(eventRow())

    const res = await post({ ...validBody, actor: 'someone-else' })

    expect(res.status).toBe(200)
    expect(res.body.content.actor).toBe('jdoe')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('does not warn when a repeated event matches the stored one', async () => {
    const warn = jest.spyOn(logger, 'warn')
    findFirst.mockResolvedValueOnce(
      eventRow({ relatedComponentId: otherComponentId.toUpperCase() })
    )

    const res = await post({
      ...validBody,
      relatedComponentId: otherComponentId,
    })

    expect(res.status).toBe(200)
    expect(warn).not.toHaveBeenCalled()
  })

  it('returns text fields as stored, the same as the GET endpoints', async () => {
    findFirst.mockResolvedValueOnce(null)
    create.mockResolvedValueOnce(eventRow({ note: 'Bytte packning  ' }))

    const res = await post({ ...validBody, note: 'Bytte packning  ' })

    expect(res.status).toBe(201)
    expect(res.body.content.note).toBe('Bytte packning  ')
  })

  it('returns 400 when relatedComponentId is the component itself', async () => {
    const res = await post({
      ...validBody,
      relatedComponentId: componentId.toUpperCase(),
    })

    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown eventType', { ...validBody, eventType: 'REMEDIED' }],
    [
      'a timestamp as occurredAt',
      { ...validBody, occurredAt: '2026-10-28T10:00:00Z' },
    ],
    [
      'a WORK_ORDER event without sourceId',
      { ...validBody, sourceId: undefined },
    ],
    [
      'a WORK_ORDER event with a null sourceId',
      { ...validBody, sourceId: null },
    ],
    ['a missing actor', { ...validBody, actor: undefined }],
  ])('returns 400 for %s', async (_, body) => {
    const res = await post(body)

    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a MANUAL event with a null sourceId', async () => {
    create.mockResolvedValueOnce(
      eventRow({ sourceType: 'MANUAL', sourceId: null })
    )

    const res = await post({
      ...validBody,
      sourceType: 'MANUAL',
      sourceId: null,
    })

    expect(res.status).toBe(201)
    expect(findFirst).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceId: null }),
    })
  })

  it('returns 400 for an invalid component id', async () => {
    const res = await post(validBody, 'not-a-uuid')

    expect(res.status).toBe(400)
  })
})

describe('GET /components/:id/events', () => {
  it('lists the events newest first', async () => {
    findMany.mockResolvedValueOnce([eventRow()])

    const res = await request(app.callback()).get(
      `/components/${componentId}/events`
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0].occurredAt).toBe('2026-10-28')
    expect(findMany).toHaveBeenCalledWith({
      where: { componentId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    })
    expect(componentCount).not.toHaveBeenCalled()
  })

  it('returns an empty list for a component without events', async () => {
    findMany.mockResolvedValueOnce([])

    const res = await request(app.callback()).get(
      `/components/${componentId}/events`
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('returns 404 when the component does not exist', async () => {
    findMany.mockResolvedValueOnce([])
    componentCount.mockResolvedValueOnce(0)

    const res = await request(app.callback()).get(
      `/components/${componentId}/events`
    )

    expect(res.status).toBe(404)
  })
})

describe('GET /component-events', () => {
  it('lists the events of one source', async () => {
    findMany.mockResolvedValueOnce([eventRow()])

    const res = await request(app.callback()).get(
      '/component-events?sourceType=WORK_ORDER&sourceId=od-123'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(findMany).toHaveBeenCalledWith({
      where: { sourceType: 'WORK_ORDER', sourceId: 'od-123' },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    })
  })

  it('returns an empty list for an unknown source', async () => {
    findMany.mockResolvedValueOnce([])

    const res = await request(app.callback()).get(
      '/component-events?sourceType=INSPECTION&sourceId=nope'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it.each([
    ['sourceId is missing', '?sourceType=WORK_ORDER'],
    ['sourceType is missing', '?sourceId=od-123'],
    ['sourceType is unknown', '?sourceType=ODOO&sourceId=od-123'],
  ])('returns 400 when %s', async (_, query) => {
    const res = await request(app.callback()).get(`/component-events${query}`)

    expect(res.status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
  })
})
