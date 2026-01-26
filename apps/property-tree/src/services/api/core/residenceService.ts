import { GET } from './base-api'
import { resolve } from '@/utils/env'
import type {
  Residence,
  ResidenceDetails,
  ResidenceSummary,
  RentalBlock,
} from '../../types'

const CORE_API_URL = resolve('VITE_CORE_API_URL', 'http://localhost:5010')

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
        query: { active: true },
      },
    })

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },

  async getRentalBlocksByRentalId(
    rentalId: string,
    active?: boolean
  ): Promise<RentalBlock[]> {
    const { data, error } = await GET(
      '/residences/rental-blocks/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId }, query: { active } },
      }
    )
    if (error) throw error
    return data.content || []
  },

  async getAllRentalBlocks(active?: boolean, page = 1, limit = 100) {
    const { data, error } = await GET('/residences/rental-blocks/all', {
      params: { query: { active, page, limit } },
    })
    if (error) throw error
    return data
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
      active?: boolean
    },
    page = 1,
    limit = 50
  ) {
    const { data, error } = await GET('/residences/rental-blocks/search', {
      params: { query: { ...params, page, limit } },
    })
    if (error) throw error
    return data
  },

  async getBlockReasons(): Promise<{ id: string; caption: string }[]> {
    const response = await fetch(`${CORE_API_URL}/residences/block-reasons`, {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch block reasons: ${response.statusText}`)
    }
    const data = await response.json()
    return data.content || []
  },

  // Note: Using raw fetch instead of GET wrapper because this endpoint
  // returns a binary Excel file (Blob), not JSON
  async exportRentalBlocksToExcel(params: {
    q?: string
    kategori?: string
    distrikt?: string
    blockReason?: string
    fastighet?: string
    fromDateGte?: string
    toDateLte?: string
    active?: boolean
  }): Promise<Blob> {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })

    const response = await fetch(
      `${CORE_API_URL}/residences/rental-blocks/export?${searchParams}`,
      { credentials: 'include' }
    )

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`)
    }

    return response.blob()
  },
}
