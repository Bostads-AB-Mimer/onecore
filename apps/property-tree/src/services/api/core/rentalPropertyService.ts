import { GET } from './base-api'

export interface RentalProperty {
  id: string
  type: string
  property: {
    rentalTypeCode: string
    rentalType: string
    address: string
    code: string
    number?: string
    type?: string
    roomTypeCode?: string
    entrance?: string
    floor?: string
    hasElevator?: boolean
    washSpace?: string
    area?: number
    estateCode?: string
    estate?: string
    buildingCode?: string
    building?: string
  }
  maintenanceUnits?: Array<{
    id: string
    rentalPropertyId: string
    code: string
    caption: string
    type: string
    estateCode: string
    estate: string
  }>
}

async function getByRentalObjectCode(
  rentalObjectCode: string
): Promise<RentalProperty> {
  const { data, error } = await GET(
    '/rental-properties/by-rental-object-code/{rentalObjectCode}',
    {
      params: { path: { rentalObjectCode } },
    }
  )

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as RentalProperty
}

export const rentalPropertyService = { getByRentalObjectCode }
