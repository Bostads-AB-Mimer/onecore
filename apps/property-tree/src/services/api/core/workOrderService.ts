import { GET, POST } from './baseApi'
import { components } from './generated/api-types'

export type InternalWorkOrder = {
  _tag: 'internal'
} & components['schemas']['WorkOrder']
export type ExternalWorkOrder = {
  _tag: 'external'
} & components['schemas']['XpandWorkOrder']
export type WorkOrder = InternalWorkOrder | ExternalWorkOrder

export type MaintenanceTeam = components['schemas']['MaintenanceTeam']
export type CreateInspectionWorkOrdersRequest =
  components['schemas']['CreateInspectionWorkOrdersRequest']
export type CreateInspectionWorkOrdersResponse =
  components['schemas']['CreateInspectionWorkOrdersResponse']

export const workOrderService = {
  async getWorkOrderForProperty(propertyId: string): Promise<WorkOrder[]> {
    const internalWorkOrders = await GET(
      '/work-orders/by-property-id/{propertyId}',
      {
        params: { path: { propertyId } },
      }
    )

    if (internalWorkOrders.error) throw internalWorkOrders.error
    if (!internalWorkOrders.data.content)
      throw new Error('No data returned from API')

    const externalWorkOrders = await GET(
      '/work-orders/xpand/by-property-id/{propertyId}',
      {
        params: { path: { propertyId } },
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

  async getWorkOrdersForBuilding(buildingId: string): Promise<WorkOrder[]> {
    const internalWorkOrders = await GET(
      '/work-orders/by-building-id/{buildingId}',
      {
        params: { path: { buildingId } },
      }
    )

    if (internalWorkOrders.error) throw internalWorkOrders.error
    if (!internalWorkOrders.data.content)
      throw new Error('No data returned from API')

    const externalWorkOrders = await GET(
      '/work-orders/xpand/by-building-id/{buildingId}',
      {
        params: { path: { buildingId } },
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

  async getWorkOrdersForResidence(
    rentalPropertyId: string
  ): Promise<WorkOrder[]> {
    const internalWorkOrders = await GET(
      '/work-orders/by-rental-property-id/{rentalPropertyId}',
      {
        params: { path: { rentalPropertyId } },
      }
    )

    if (internalWorkOrders.error) throw internalWorkOrders.error
    if (!internalWorkOrders.data.content)
      throw new Error('No data returned from API')

    const externalWorkOrders = await GET(
      '/work-orders/xpand/by-rental-property-id/{rentalPropertyId}',
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

  async getWorkOrdersForMaintenanceUnit(
    maintenanceUnitCode: string
  ): Promise<WorkOrder[]> {
    const internalWorkOrders = await GET(
      '/work-orders/by-maintenance-unit-code/{maintenanceUnitCode}',
      {
        params: { path: { maintenanceUnitCode } },
      }
    )

    if (internalWorkOrders.error) throw internalWorkOrders.error
    if (!internalWorkOrders.data.content)
      throw new Error('No data returned from API')

    const externalWorkOrders = await GET(
      '/work-orders/xpand/by-maintenance-unit-code/{maintenanceUnitCode}',
      {
        params: { path: { maintenanceUnitCode } },
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

  async getWorkOrdersByContactCode(contactCode: string): Promise<WorkOrder[]> {
    const internalWorkOrders = await GET(
      '/work-orders/by-contact-code/{contactCode}',
      {
        params: { path: { contactCode } },
      }
    )

    if (internalWorkOrders.error) throw internalWorkOrders.error
    if (!internalWorkOrders.data.content)
      throw new Error('No data returned from API')

    const externalWorkOrders = await GET(
      '/work-orders/xpand/by-contact-code/{contactCode}',
      {
        params: { path: { contactCode } },
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

  // Resursgrupper (maintenance teams) for the inspection work-order picker.
  async getMaintenanceTeams(): Promise<MaintenanceTeam[]> {
    const response = await GET('/work-orders/maintenance-teams', {})

    if (response.error) throw new Error('Failed to fetch maintenance teams')
    if (!response.data.content) throw new Error('No data returned from API')

    return response.data.content
  },

  // Creates one work order per resursgrupp from an inspection (see core route).
  async createInspectionWorkOrders(
    body: CreateInspectionWorkOrdersRequest
  ): Promise<CreateInspectionWorkOrdersResponse> {
    const response = await POST('/work-orders/from-inspection', { body })

    if (response.error)
      throw new Error('Failed to create inspection work orders')
    if (!response.data.content) throw new Error('No data returned from API')

    return response.data.content
  },
}
