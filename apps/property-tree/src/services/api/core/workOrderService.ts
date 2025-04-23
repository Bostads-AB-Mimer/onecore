import { GET } from './base-api'
import { components } from './generated/api-types'

export type WorkOrder = components['schemas']['WorkOrder']

export const workOrderService = {
  async getWorkOrdersForResidence(residenceId: string): Promise<WorkOrder[]> {
    const { data, error } = await GET(
      '/workOrders/rentalPropertyId/{rentalPropertyId}',
      {
        params: { path: { rentalPropertyId: residenceId } },
      }
    )

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content.workOrders ?? []
  },
}
