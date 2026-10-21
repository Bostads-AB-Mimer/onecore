import { describe, expect, it, vi } from 'vitest'

vi.mock('./baseApi', () => ({ GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() }))

import { GET } from './baseApi'
import { componentService, toComponentBody } from './componentService'

const subtypeId = '00000000-0000-0000-0002-000000000001'

describe('toComponentBody', () => {
  it('builds a surface payload with no model, no serial and null numerics', () => {
    expect(toComponentBody({ subtypeId })).toEqual({
      subtypeId,
      modelId: null,
      serialNumber: undefined,
      warrantyStartDate: undefined,
      warrantyMonths: null,
      priceAtPurchase: null,
      depreciationPriceAtPurchase: null,
      economicLifespan: null,
      status: 'ACTIVE',
      condition: undefined,
      quantity: 1,
      ncsCode: null,
    })
  })

  it('turns an empty ncsCode into null and keeps a real one', () => {
    expect(toComponentBody({ subtypeId, ncsCode: '' }).ncsCode).toBeNull()
    expect(toComponentBody({ subtypeId, ncsCode: 'S 0500-N' }).ncsCode).toBe(
      'S 0500-N'
    )
  })

  it('keeps specifications and additionalInformation', () => {
    expect(
      toComponentBody({
        subtypeId,
        specifications: 'Vit, matt',
        additionalInformation: 'Målad 2024',
      })
    ).toMatchObject({
      specifications: 'Vit, matt',
      additionalInformation: 'Målad 2024',
    })
  })

  it('keeps a quantity of zero', () => {
    expect(toComponentBody({ subtypeId, quantity: 0 }).quantity).toBe(0)
  })

  it('passes an appliance payload through', () => {
    const body = toComponentBody({
      subtypeId,
      modelId: '00000000-0000-0000-0003-000000000001',
      serialNumber: '4711',
      warrantyMonths: 24,
      priceAtPurchase: 5000,
      depreciationPriceAtPurchase: 4000,
      economicLifespan: 15,
      status: 'INACTIVE',
      condition: 'GOOD',
      quantity: 2,
    })

    expect(body).toMatchObject({
      modelId: '00000000-0000-0000-0003-000000000001',
      serialNumber: '4711',
      warrantyMonths: 24,
      priceAtPurchase: 5000,
      depreciationPriceAtPurchase: 4000,
      economicLifespan: 15,
      status: 'INACTIVE',
      condition: 'GOOD',
      quantity: 2,
    })
  })
})

describe('getSurfaceSubtypes', () => {
  it('asks for SURFACE subtypes with the backend page cap and returns the content', async () => {
    vi.mocked(GET).mockResolvedValueOnce({
      data: { content: [{ id: 's1' }] },
      error: undefined,
    } as never)

    await expect(componentService.getSurfaceSubtypes()).resolves.toEqual([
      { id: 's1' },
    ])
    expect(GET).toHaveBeenCalledWith('/component-subtypes', {
      params: { query: { categoryType: 'SURFACE', page: 1, limit: 100 } },
    })
  })

  it('fetches every page', async () => {
    vi.mocked(GET)
      .mockResolvedValueOnce({
        data: { content: [{ id: 's1' }], pagination: { totalPages: 2 } },
        error: undefined,
      } as never)
      .mockResolvedValueOnce({
        data: { content: [{ id: 's2' }], pagination: { totalPages: 2 } },
        error: undefined,
      } as never)

    await expect(componentService.getSurfaceSubtypes()).resolves.toEqual([
      { id: 's1' },
      { id: 's2' },
    ])
    expect(GET).toHaveBeenLastCalledWith('/component-subtypes', {
      params: { query: { categoryType: 'SURFACE', page: 2, limit: 100 } },
    })
  })

  it('returns an empty list when content is missing', async () => {
    vi.mocked(GET).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    } as never)

    await expect(componentService.getSurfaceSubtypes()).resolves.toEqual([])
  })
})
