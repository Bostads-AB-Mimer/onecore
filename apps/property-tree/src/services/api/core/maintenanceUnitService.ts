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
}
