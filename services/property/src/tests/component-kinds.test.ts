jest.mock('../adapters/db', () => ({
  prisma: { componentModels: { findMany: jest.fn() } },
}))

import { prisma } from '../adapters/db'
import { getSurfaceModels } from '../adapters/component-model-adapter'
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
        where: { subtype: { componentType: { category: { type: 'SURFACE' } } } },
      })
    )
  })
})
