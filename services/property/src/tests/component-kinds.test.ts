jest.mock('../adapters/db', () => ({
  prisma: {
    componentModels: { findMany: jest.fn() },
    componentCategories: { findUnique: jest.fn(), update: jest.fn() },
    componentTypes: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'

import { prisma } from '../adapters/db'
import { getSurfaceModels } from '../adapters/component-model-adapter'
import { findComponentTypeCodeProblem } from '../adapters/component-type-adapter'
import { routes as categoryRoutes } from '../routes/component-categories'
import { routes as typeRoutes } from '../routes/component-types'
import {
  ComponentCategorySchema,
  ComponentTypeSchema,
  CreateComponentCategorySchema,
  CreateComponentTypeSchema,
} from '../types/component'

const timestamps = {
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('Component category type', () => {
  it('is part of a category', () => {
    const category = ComponentCategorySchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      categoryName: 'Ytskikt',
      description: 'Golv, väggar och tak',
      type: 'SURFACE',
      ...timestamps,
    })

    expect(category).toMatchObject({ type: 'SURFACE' })
  })

  it('defaults a new category to EQUIPMENT', () => {
    const category = CreateComponentCategorySchema.parse({
      categoryName: 'Vitvaror',
      description: 'Kyl, frys, spis',
    })

    expect(category).toMatchObject({ type: 'EQUIPMENT' })
  })

  it('rejects an unknown category type', () => {
    const result = CreateComponentCategorySchema.safeParse({
      categoryName: 'Möbler',
      description: 'Lösa möbler',
      type: 'FURNITURE',
    })

    expect(result.success).toBe(false)
  })
})

describe('Component type code', () => {
  it('is optional on a type', () => {
    const type = ComponentTypeSchema.parse({
      id: '00000000-0000-0000-0001-000000000001',
      typeName: 'Diskmaskin',
      categoryId: '00000000-0000-0000-0000-000000000001',
      description: null,
      code: null,
      ...timestamps,
    })

    expect(type).toMatchObject({ code: null })
  })

  it('accepts a surface code on a new type', () => {
    const type = CreateComponentTypeSchema.parse({
      typeName: 'Vägg',
      categoryId: '00000000-0000-0000-0000-000000000001',
      code: 'WALL',
    })

    expect(type).toMatchObject({ code: 'WALL' })
  })

  it('rejects an unknown type code', () => {
    const result = CreateComponentTypeSchema.safeParse({
      typeName: 'Yttertak',
      categoryId: '00000000-0000-0000-0000-000000000001',
      code: 'ROOF',
    })

    expect(result.success).toBe(false)
  })
})

describe('getSurfaceModels', () => {
  it('finds surface models by category type, not by name', async () => {
    ;(prisma.componentModels.findMany as jest.Mock).mockResolvedValueOnce([])

    await getSurfaceModels()

    expect(prisma.componentModels.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subtype: { componentType: { category: { type: 'SURFACE' } } },
        },
      })
    )
  })
})

describe('findComponentTypeCodeProblem', () => {
  const categoryId = '00000000-0000-0000-0000-000000000001'
  const findCategory = prisma.componentCategories.findUnique as jest.Mock
  const findType = prisma.componentTypes.findFirst as jest.Mock

  beforeEach(() => {
    findCategory.mockReset()
    findType.mockReset()
  })

  it('skips the check when no code is given', async () => {
    await expect(
      findComponentTypeCodeProblem({ code: null, categoryId })
    ).resolves.toBeNull()
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('rejects a code on a category that is not SURFACE', async () => {
    findCategory.mockResolvedValueOnce({ type: 'EQUIPMENT' })

    await expect(
      findComponentTypeCodeProblem({ code: 'WALL', categoryId })
    ).resolves.toBe('category_not_surface')
  })

  it('rejects a code when the category does not exist', async () => {
    findCategory.mockResolvedValueOnce(null)

    await expect(
      findComponentTypeCodeProblem({ code: 'WALL', categoryId })
    ).resolves.toBe('category_not_found')
  })

  it('rejects a code another type already has', async () => {
    findCategory.mockResolvedValueOnce({ type: 'SURFACE' })
    findType.mockResolvedValueOnce({ id: 'other' })

    await expect(
      findComponentTypeCodeProblem({ code: 'WALL', categoryId })
    ).resolves.toBe('code_taken')
  })

  it('ignores the type being updated when checking for duplicates', async () => {
    findCategory.mockResolvedValueOnce({ type: 'SURFACE' })
    findType.mockResolvedValueOnce(null)

    await expect(
      findComponentTypeCodeProblem({
        code: 'WALL',
        categoryId,
        excludeTypeId: 'self',
      })
    ).resolves.toBeNull()
    expect(findType).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'WALL', id: { not: 'self' } },
      })
    )
  })
})

describe('PUT /component-categories/:id', () => {
  const categoryId = '00000000-0000-0000-0000-000000000001'
  const app = new Koa()
  const router = new KoaRouter()
  categoryRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  const findCategory = prisma.componentCategories.findUnique as jest.Mock
  const updateCategory = prisma.componentCategories.update as jest.Mock

  beforeEach(() => {
    findCategory.mockReset()
    updateCategory.mockReset()
  })

  it('refuses to make a category EQUIPMENT while its types carry codes', async () => {
    findCategory.mockResolvedValueOnce({
      id: categoryId,
      type: 'SURFACE',
      componentTypes: [{ id: 't1', code: 'WALL' }],
    })

    const res = await request(app.callback())
      .put(`/component-categories/${categoryId}`)
      .send({ type: 'EQUIPMENT' })

    expect(res.status).toBe(409)
    expect(updateCategory).not.toHaveBeenCalled()
  })

  it('lets a category leave SURFACE once no type carries a code', async () => {
    findCategory.mockResolvedValueOnce({
      id: categoryId,
      type: 'SURFACE',
      componentTypes: [{ id: 't1', code: null }],
    })
    updateCategory.mockResolvedValueOnce({
      id: categoryId,
      categoryName: 'Ytskikt',
      description: 'Golv, väggar och tak',
      type: 'EQUIPMENT',
      ...timestamps,
    })

    const res = await request(app.callback())
      .put(`/component-categories/${categoryId}`)
      .send({ type: 'EQUIPMENT' })

    expect(res.status).toBe(200)
    expect(res.body.content.type).toBe('EQUIPMENT')
  })
})

describe('POST and PUT /component-types', () => {
  const surfaceCategoryId = '00000000-0000-0000-0000-000000000001'
  const equipmentCategoryId = '00000000-0000-0000-0000-000000000002'
  const typeId = '00000000-0000-0000-0001-000000000001'
  const app = new Koa()
  const router = new KoaRouter()
  typeRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  const findCategory = prisma.componentCategories.findUnique as jest.Mock
  const findType = prisma.componentTypes.findUnique as jest.Mock
  const findOtherType = prisma.componentTypes.findFirst as jest.Mock
  const createType = prisma.componentTypes.create as jest.Mock
  const updateType = prisma.componentTypes.update as jest.Mock

  const wallType = {
    id: typeId,
    typeName: 'Vägg',
    categoryId: surfaceCategoryId,
    description: null,
    code: 'WALL',
    category: {
      id: surfaceCategoryId,
      categoryName: 'Ytskikt',
      description: 'Golv, väggar och tak',
      type: 'SURFACE',
      ...timestamps,
    },
    ...timestamps,
  }

  beforeEach(() => {
    findCategory.mockReset()
    findType.mockReset()
    findOtherType.mockReset()
    createType.mockReset()
    updateType.mockReset()
  })

  it('creates a type with a code in a SURFACE category', async () => {
    findCategory.mockResolvedValueOnce({ type: 'SURFACE' })
    findOtherType.mockResolvedValueOnce(null)
    createType.mockResolvedValueOnce(wallType)

    const res = await request(app.callback())
      .post('/component-types')
      .send({ typeName: 'Vägg', categoryId: surfaceCategoryId, code: 'WALL' })

    expect(res.status).toBe(201)
    expect(res.body.content.code).toBe('WALL')
  })

  it('rejects a code in an EQUIPMENT category on create', async () => {
    findCategory.mockResolvedValueOnce({ type: 'EQUIPMENT' })

    const res = await request(app.callback()).post('/component-types').send({
      typeName: 'Diskmaskin',
      categoryId: equipmentCategoryId,
      code: 'WALL',
    })

    expect(res.status).toBe(400)
    expect(createType).not.toHaveBeenCalled()
  })

  it('returns 409 when the unique index rejects a concurrent duplicate', async () => {
    findCategory.mockResolvedValueOnce({ type: 'SURFACE' })
    findOtherType.mockResolvedValueOnce(null)
    createType.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    )

    const res = await request(app.callback()).post('/component-types').send({
      typeName: 'Innervägg',
      categoryId: surfaceCategoryId,
      code: 'WALL',
    })

    expect(res.status).toBe(409)
  })

  it('rejects moving a coded type into an EQUIPMENT category', async () => {
    findType.mockResolvedValueOnce(wallType)
    findCategory.mockResolvedValueOnce({ type: 'EQUIPMENT' })

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ categoryId: equipmentCategoryId })

    expect(res.status).toBe(400)
    expect(findCategory).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: equipmentCategoryId } })
    )
    expect(updateType).not.toHaveBeenCalled()
  })

  it('renames a coded type without re-checking the code', async () => {
    findType.mockResolvedValueOnce(wallType)
    updateType.mockResolvedValueOnce({ ...wallType, typeName: 'Innervägg' })

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ typeName: 'Innervägg' })

    expect(res.status).toBe(200)
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('clears a code with null', async () => {
    findType.mockResolvedValueOnce(wallType)
    updateType.mockResolvedValueOnce({ ...wallType, code: null })

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ code: null })

    expect(res.status).toBe(200)
    expect(res.body.content.code).toBeNull()
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('returns 409 when an update loses the race on the unique index', async () => {
    findType.mockResolvedValueOnce({ ...wallType, code: null })
    findCategory.mockResolvedValueOnce({ type: 'SURFACE' })
    findOtherType.mockResolvedValueOnce(null)
    updateType.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    )

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ code: 'WALL' })

    expect(res.status).toBe(409)
  })
})
