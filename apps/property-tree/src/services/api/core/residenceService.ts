import { GET } from './base-api'
import { components } from './generated/api-types'

type Residence = components['schemas']['Residence']
type ResidenceDetails = components['schemas']['ResidenceDetails']
type ResidenceSummary = components['schemas']['ResidenceSummary']

export type RentalBlockWithResidence =
  components['schemas']['RentalBlockWithResidence']

export const residenceService = {
  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const { data, error } = await GET('/residences', {
      params: { query: { buildingCode } },
    })
    if (error) throw error
    return data.content || []
  },

  async getByBuildingCodeAndStaircaseCode(
    buildingCode: string,
    staircaseCode: string
  ): Promise<ResidenceSummary[]> {
    const { data, error } = await GET(
      '/residences/summary/by-building-code/{buildingCode}',
      {
        params: { path: { buildingCode }, query: { staircaseCode } },
      }
    )
    if (error) throw error
    return data.content || []
  },

  async getById(residenceId: string): Promise<ResidenceDetails> {
    const { data, error } = await GET(`/residences/{residenceId}`, {
      params: {
        path: { residenceId },
        query: { includeActiveBlocksOnly: true },
      },
    })

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },

  async getRentalBlocksByRentalId(
    rentalId: string,
    includeActiveBlocksOnly = false
  ): Promise<components['schemas']['RentalBlock'][]> {
    const { data, error } = await GET(
      '/residences/rental-blocks/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId }, query: { includeActiveBlocksOnly } },
      }
    )
    if (error) throw error
    return data.content || []
  },

  async getAllRentalBlocks(
    includeActiveBlocksOnly = false,
    page = 1,
    limit = 100
  ): Promise<{
    content: RentalBlockWithResidence[]
    _meta: { totalRecords: number; page: number; limit: number; count: number }
  }> {
    const { data, error } = await GET('/residences/rental-blocks/all', {
      params: { query: { includeActiveBlocksOnly, page, limit } },
    })
    if (error) throw error
    return {
      content: data.content || [],
      _meta: {
        totalRecords: data._meta?.totalRecords ?? 0,
        page: data._meta?.page ?? page,
        limit: data._meta?.limit ?? limit,
        count: data._meta?.count ?? data.content?.length ?? 0,
      },
    }
  },

  async searchRentalBlocks(
    params: {
      q?: string
      fields?: string
      kategori?: string
      distrikt?: string
      blockReason?: string
      fastighet?: string
      fromDateGte?: string
      toDateLte?: string
      includeActiveBlocksOnly?: boolean
    },
    page = 1,
    limit = 50
  ): Promise<{
    content: RentalBlockWithResidence[]
    _meta: { totalRecords: number; page: number; limit: number; count: number }
  }> {
    // Note: Using type assertion until OpenAPI types are regenerated
    const { data, error } = await GET(
      '/residences/rental-blocks/search' as '/residences/rental-blocks/all',
      {
        params: { query: { ...params, page, limit } as never },
      }
    )
    if (error) throw error
    const typedData = data as {
      content?: RentalBlockWithResidence[]
      _meta?: {
        totalRecords: number
        page: number
        limit: number
        count: number
      }
    }
    return {
      content: typedData.content || [],
      _meta: {
        totalRecords: typedData._meta?.totalRecords ?? 0,
        page: typedData._meta?.page ?? page,
        limit: typedData._meta?.limit ?? limit,
        count: typedData._meta?.count ?? typedData.content?.length ?? 0,
      },
    }
  },
}
