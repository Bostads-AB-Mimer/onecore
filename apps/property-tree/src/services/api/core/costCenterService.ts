import { z } from 'zod'

import { GET, PATCH } from './baseApi'
import type { components } from './generated/api-types'

export const costCenterService = {
  async getAll() {
    const { data, error } = await GET('/cost-centers')
    if (error) throw error
    return data?.content || []
  },

  async getTreeById(id: string) {
    const { data, error } = await GET('/cost-centers/{id}/tree', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content
  },
}

export type KvvAreaResolveParams =
  { rentalId: string } | { buildingCode: string } | { propertyCode: string }

export type PropertyKvvAreaLookup =
  components['schemas']['PropertyKvvAreaLookup']

// Core tags its "no KVV-area" 404 with this code so it can be told apart from
// a routing 404 (e.g. a core deployed without the route). The generated types
// declare no 404 body, so the error is checked at runtime instead.
const KvvAreaNotFoundBodySchema = z.object({
  code: z.literal('KVV_AREA_NOT_FOUND'),
})

export const kvvAreaService = {
  // Resolves the KVV-area, district and responsible kvartersvärd of a
  // location. Returns null when the location has no KVV-area.
  async resolve(
    params: KvvAreaResolveParams
  ): Promise<PropertyKvvAreaLookup | null> {
    const { data, error, response } = await GET('/kvv-areas/resolve', {
      params: { query: params },
    })
    if (
      response.status === 404 &&
      KvvAreaNotFoundBodySchema.safeParse(error).success
    ) {
      return null
    }
    if (!response.ok || !data) {
      throw error ?? new Error(`KVV-area resolve failed: ${response.status}`)
    }
    return data.content ?? null
  },

  async updateResponsible(id: string, keycloakUserId: string): Promise<void> {
    const { error } = await PATCH('/kvv-areas/{id}/responsible', {
      params: { path: { id } },
      body: { keycloakUserId },
    })
    if (error) throw error
  },
}
