import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './baseApi'
import { componentLibraryService } from './componentLibraryService'

vi.mock('./baseApi', () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn(),
}))

const mockGet = vi.mocked(GET)

describe('componentLibraryService.getModels', () => {
  beforeEach(() => mockGet.mockReset())

  it('walks every page of a subtype with more than 100 models', async () => {
    const page = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `m-${offset + i}` }))
    mockGet
      .mockResolvedValueOnce({
        data: { content: page(100, 0) },
        error: undefined,
      } as never)
      .mockResolvedValueOnce({
        data: { content: page(26, 100) },
        error: undefined,
      } as never)

    const models = await componentLibraryService.getModels('sub-1')

    expect(models).toHaveLength(126)
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(mockGet.mock.calls[1][1]).toEqual({
      params: {
        query: {
          subtypeId: 'sub-1',
          limit: 100,
          page: 2,
          modelName: undefined,
        },
      },
    })
  })

  it('fetches a single page when no subtype is given', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        content: Array.from({ length: 100 }, (_, i) => ({ id: `m-${i}` })),
      },
      error: undefined,
    } as never)

    const models = await componentLibraryService.getModels('', {
      search: 'el',
    })

    expect(models).toHaveLength(100)
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet.mock.calls[0][1]).toEqual({
      params: {
        query: {
          subtypeId: undefined,
          limit: 100,
          page: 1,
          modelName: 'el',
        },
      },
    })
  })
})

describe('componentLibraryService.getComponentPage', () => {
  beforeEach(() => mockGet.mockReset())

  it('asks for one page of a subtype, filtered by model and serial number', async () => {
    mockGet.mockResolvedValue({
      data: {
        content: [{ id: 'c1' }],
        pagination: { page: 3, limit: 25, total: 45958, totalPages: 1839 },
      },
      error: undefined,
    } as never)

    const result = await componentLibraryService.getComponentPage({
      subtypeId: 'sub-1',
      modelId: 'm-1',
      search: ' 2410 ',
      page: 3,
      limit: 25,
    })

    expect(mockGet).toHaveBeenCalledWith('/components', {
      params: {
        query: {
          subtypeId: 'sub-1',
          modelId: 'm-1',
          serialNumber: '2410',
          page: 3,
          limit: 25,
        },
      },
    })
    expect(result).toEqual({
      content: [{ id: 'c1' }],
      pagination: { page: 3, limit: 25, total: 45958, totalPages: 1839 },
    })
  })

  it('asks for components without a model', async () => {
    mockGet.mockResolvedValue({
      data: { content: [] },
      error: undefined,
    } as never)

    await componentLibraryService.getComponentPage({
      subtypeId: 'sub-1',
      withoutModel: true,
      page: 1,
      limit: 25,
    })

    expect(mockGet).toHaveBeenCalledWith('/components', {
      params: {
        query: expect.objectContaining({
          subtypeId: 'sub-1',
          withoutModel: true,
        }),
      },
    })
  })

  it('drops a search shorter than two characters', async () => {
    mockGet.mockResolvedValue({ data: {}, error: undefined } as never)

    await componentLibraryService.getComponentPage({
      subtypeId: 'sub-1',
      search: 'a',
      page: 1,
      limit: 25,
    })

    expect(mockGet.mock.calls[0][1]).toEqual({
      params: {
        query: {
          subtypeId: 'sub-1',
          modelId: undefined,
          serialNumber: undefined,
          page: 1,
          limit: 25,
        },
      },
    })
  })

  it('fills an empty page when the response has no body', async () => {
    mockGet.mockResolvedValue({ data: {}, error: undefined } as never)

    const result = await componentLibraryService.getComponentPage({
      subtypeId: 'sub-1',
      page: 2,
      limit: 25,
    })

    expect(result).toEqual({
      content: [],
      pagination: { page: 2, limit: 25, total: 0, totalPages: 0 },
    })
  })

  it('counts the rows when the response has no pagination', async () => {
    mockGet.mockResolvedValue({
      data: { content: [{ id: 'c1' }, { id: 'c2' }] },
      error: undefined,
    } as never)

    const result = await componentLibraryService.getComponentPage({
      subtypeId: 'sub-1',
      page: 1,
      limit: 25,
    })

    expect(result.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 2,
      totalPages: 1,
    })
  })

  it('throws the API error', async () => {
    const error = { message: 'boom' }
    mockGet.mockResolvedValue({ data: undefined, error } as never)

    await expect(
      componentLibraryService.getComponentPage({
        subtypeId: 'sub-1',
        page: 1,
        limit: 25,
      })
    ).rejects.toBe(error)
  })
})
