import type { CostCenterTreeKvvArea } from '@/services/types'

import { sortStreetAddresses } from '@/shared/lib/addresses'
import { formatUserName } from '@/shared/lib/formatters'

import type { KvvAreaInfo, PropertyForAdmin } from '../types/adminTypes'

export function mapKvvArea(area: CostCenterTreeKvvArea): KvvAreaInfo {
  const aggregates = area.properties.reduce(
    (acc, p) => ({
      propertyCount: acc.propertyCount + 1,
      residenceCount: acc.residenceCount + p.aggregates.residenceCount,
      parkingCount: acc.parkingCount + p.aggregates.parkingCount,
      entranceCount: acc.entranceCount + p.aggregates.entranceCount,
    }),
    { propertyCount: 0, residenceCount: 0, parkingCount: 0, entranceCount: 0 }
  )

  const stewardName = area.responsible
    ? formatUserName(area.responsible).name
    : area.name || area.code

  return {
    kvvAreaId: area.id,
    kvvArea: area.code,
    stewardRefNr: area.responsible?.employeeId ?? '',
    stewardName,
    stewardPhone: area.responsible?.mobilePhone,
    propertyCount: aggregates.propertyCount,
    residenceCount: aggregates.residenceCount,
    parkingCount: aggregates.parkingCount,
    entranceCount: aggregates.entranceCount,
  }
}

export function mapProperties(area: CostCenterTreeKvvArea): PropertyForAdmin[] {
  return area.properties.map((property) => ({
    id: `${area.code}-${property.code}`,
    propertyCode: property.code,
    propertyName: property.designation || property.tract || property.code,
    addresses: sortStreetAddresses(
      property.addresses
        .map((a) => a.buildingName)
        .filter((v): v is string => !!v)
    ),
    buildingType:
      property.addresses.find((a) => a.buildingType)?.buildingType ?? null,
    kvvAreaId: area.id,
    kvvArea: area.code,
    stewardRefNr: area.responsible?.username ?? '',
    costCenter: '',
    residenceCount: property.aggregates.residenceCount,
    parkingCount: property.aggregates.parkingCount,
    entranceCount: property.aggregates.entranceCount,
  }))
}
