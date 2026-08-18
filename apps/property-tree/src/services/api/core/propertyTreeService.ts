import { GET } from './baseApi'
import type { components, paths } from './generated/api-types'

export type PropertyTree = components['schemas']['PropertyTree']
export type PropertyGrouping = PropertyTree['grouping']
export type PropertyTreeGroup = PropertyTree['groups'][number]
export type PropertyTreeProperty = PropertyTreeGroup['properties'][number]
export type MarketAreaSummary = components['schemas']['MarketAreaSummary']

export type RentalObjectSubtype = components['schemas']['RentalObjectSubtype']
export type RentalObjectDetails = components['schemas']['RentalObjectDetails']

/** Where to look for rental objects: the scopes both object endpoints take,
 * straight from the generated schema so a new one never has to be hand-copied
 * here. Alternatives, not a conjunction — an object matches under any. */
export type RentalObjectScopeParams = NonNullable<
  paths['/rental-objects/details']['get']['parameters']['query']
>

/** The scopes above plus the search's own filters: `types`, `subtypes` as
 * `type:code` pairs (a subtype code is unique only within its type), free-text
 * `q`, and paging. */
export type RentalObjectSearchParams = NonNullable<
  paths['/rental-objects/search']['get']['parameters']['query']
>

export const propertyTreeService = {
  /** Roots of one grouping are listed by their own endpoint; this covers
   * marknadsområden (cost centers use costCenterService.getAll). */
  async getMarketAreas() {
    const { data, error } = await GET('/market-areas')
    if (error) throw error
    return data?.content || []
  },

  /** rootId is a cost center uuid, a market area code, or a company code. */
  async getTree(grouping: PropertyGrouping, rootId: string) {
    const { data, error } = await GET('/property-tree', {
      params: { query: { groupBy: grouping, rootId } },
    })
    if (error) throw error
    return data?.content
  },

  /** Every rental object under one grouping root — the data clients filter,
   * count and list locally instead of re-querying per filter change. */
  async getRootRentalObjects(grouping: PropertyGrouping, rootId: string) {
    const { data, error } = await GET('/rental-objects/by-root', {
      params: { query: { groupBy: grouping, rootId } },
    })
    if (error) throw error
    return data?.content || []
  },

  /** Grundhyra, BRA, annan information and anläggnings-ID for the objects a
   * selection covers. Takes the search's scopes; the server resolves them to
   * properties, so ticking one trapphus costs one fastighet. */
  async getRentalObjectDetails(scopes: RentalObjectScopeParams) {
    const { data, error } = await GET('/rental-objects/details', {
      params: { query: scopes },
    })
    if (error) throw error
    return data?.content || []
  },

  /** Subtype captions per object type, limited to those actually in use. */
  async getSubtypes() {
    const { data, error } = await GET('/rental-object-subtypes')
    if (error) throw error
    return data?.content || []
  },

  async searchRentalObjects(params: RentalObjectSearchParams) {
    const { data, error } = await GET('/rental-objects/search', {
      params: { query: params },
    })
    if (error) throw error
    return {
      content: data?.content ?? [],
      totalCount: data?.totalCount ?? 0,
    }
  },
}
