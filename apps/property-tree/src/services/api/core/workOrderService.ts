import { GET } from './base-api'
import { components } from './generated/api-types'

export type InternalWorkOrder = {
  _tag: 'internal'
} & components['schemas']['WorkOrder']
export type ExternalWorkOrder = {
  _tag: 'external'
} & components['schemas']['XpandWorkOrder']
export type WorkOrder = InternalWorkOrder | ExternalWorkOrder

export const workOrderService = {
  async getWorkOrdersForResidence(
    rentalPropertyId: string
  ): Promise<WorkOrder[]> {
    const internalWorkOrders = await GET(
      '/workOrders/rentalPropertyId/{rentalPropertyId}',
      {
        params: { path: { rentalPropertyId } },
      }
    )

    if (internalWorkOrders.error) throw internalWorkOrders.error
    if (!internalWorkOrders.data.content)
      throw new Error('No data returned from API')

    const externalWorkOrders = await GET(
      '/workOrders/xpand/rentalPropertyId/{rentalPropertyId}',
      {
        params: { path: { rentalPropertyId } },
      }
    )

    if (externalWorkOrders.error) throw externalWorkOrders.error
    if (!externalWorkOrders.data.content)
      throw new Error('No data returned from API')

    return [
      ...(internalWorkOrders.data.content.workOrders ?? []).map((v) => ({
        _tag: 'internal' as const,
        ...v,
      })),
      ...(externalWorkOrders.data.content.workOrders ?? []).map((v) => ({
        _tag: 'external' as const,
        ...v,
      })),
    ]
  },
}
