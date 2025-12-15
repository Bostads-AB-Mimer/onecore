import { GET } from './base-api'
import type { MaintenanceUnit } from '@/services/types'

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

  async getByRentalId(rentalId: string): Promise<MaintenanceUnit> {
    const { data, error } = await GET(
      '/maintenance-units/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId } },
      }
    )

    if (error) throw error
    const units = (data?.content as MaintenanceUnit[]) || []
    if (units.length === 0) throw new Error('No maintenance unit found')

    return units[0]
  },
}
