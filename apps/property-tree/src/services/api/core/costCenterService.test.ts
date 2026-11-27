import { afterEach, describe, expect, it, vi } from 'vitest'

import * as baseApi from './baseApi'
import { kvvAreaService } from './costCenterService'

vi.mock('./baseApi', () => ({
  GET: vi.fn(),
  PATCH: vi.fn(),
}))

// The mocks below are partial openapi-fetch results (`as never`): resolve
// only reads data, error, response.status and response.ok.
const GET = vi.mocked(baseApi.GET)

describe('kvvAreaService.resolve', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns the resolved KVV-area', async () => {
    const content = { kvvArea: { code: 'A' }, responsible: null }
    GET.mockResolvedValue({
      data: { content },
      response: { status: 200, ok: true },
    } as never)

    await expect(kvvAreaService.resolve({ rentalId: '1' })).resolves.toEqual(
      content
    )
    expect(GET).toHaveBeenCalledWith('/kvv-areas/resolve', {
      params: { query: { rentalId: '1' } },
    })
  })

  it('returns null when the location has no KVV-area', async () => {
    GET.mockResolvedValue({
      error: { code: 'KVV_AREA_NOT_FOUND' },
      response: { status: 404, ok: false },
    } as never)

    await expect(
      kvvAreaService.resolve({ buildingCode: '2' })
    ).resolves.toBeNull()
  })

  it('throws on a 404 without KVV_AREA_NOT_FOUND', async () => {
    GET.mockResolvedValue({
      error: { error: 'Not Found' },
      response: { status: 404, ok: false },
    } as never)

    await expect(kvvAreaService.resolve({ buildingCode: '2' })).rejects.toEqual(
      { error: 'Not Found' }
    )
  })

  it('throws on a failed request without a body', async () => {
    GET.mockResolvedValue({
      response: { status: 502, ok: false },
    } as never)

    await expect(kvvAreaService.resolve({ rentalId: '1' })).rejects.toThrow(
      '502'
    )
  })

  it('throws on other errors', async () => {
    GET.mockResolvedValue({
      error: { error: 'x' },
      response: { status: 500, ok: false },
    } as never)

    await expect(kvvAreaService.resolve({ propertyCode: '3' })).rejects.toEqual(
      { error: 'x' }
    )
  })
})
