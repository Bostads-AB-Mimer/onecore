import type { MaintenanceUnit } from '@/services/types'

import { GET } from './baseApi'

export const maintenanceUnitService = {
  async getByPropertyCode(propertyCode: string): Promise<MaintenanceUnit[]> {
    const { data, error } = await GET(
      '/maintenance-units/by-property-code/{code}',
      {
        params: { path: { code: propertyCode } },
      }
    )
    if (error) throw error
    return (data?.content as MaintenanceUnit[]) || []
  },

  async getByBuildingCode(buildingCode: string): Promise<MaintenanceUnit[]> {
    const { data, error } = await GET(
      '/maintenance-units/by-building-code/{buildingCode}',
      {
        params: { path: { buildingCode } },
      }
    )
    if (error) throw error
    return (data?.content as MaintenanceUnit[]) || []
  },

  async getByRentalId(rentalId: string): Promise<MaintenanceUnit[]> {
    const { data, error } = await GET(
      '/maintenance-units/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId } },
      }
    )
    if (error) throw error
    return (data?.content as MaintenanceUnit[]) || []
  },

  async getByCode(code: string): Promise<MaintenanceUnit> {
    const { data, error } = await GET('/maintenance-units/by-code/{code}', {
      params: { path: { code } },
    })

    if (error) throw error
    if (!data?.content) throw new Error('No maintenance unit found')

    return data.content as MaintenanceUnit
  },
}
