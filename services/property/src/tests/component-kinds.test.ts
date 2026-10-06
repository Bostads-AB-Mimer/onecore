jest.mock('../adapters/db', () => ({
  prisma: {
    componentModels: { findMany: jest.fn() },
    componentCategories: { findUnique: jest.fn(), update: jest.fn() },
    componentTypes: { findUnique: jest.fn(), findFirst: jest.fn() },
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
