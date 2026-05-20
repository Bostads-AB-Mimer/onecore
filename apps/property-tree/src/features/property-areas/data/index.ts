import {
  BUILDING_TYPES,
  COST_CENTER_NAMES,
  DISTRICT_MANAGERS,
  DistrictManagers,
  PropertyAreaEntry,
} from '../types'
import {
  getKvvArea,
  getUniqueKvvAreas,
  STEWARD_TO_KVV_AREA,
} from './kvvMapping'
import { propertyAreaEntries } from './propertyAreas'

export {
  getKvvArea,
  getUniqueKvvAreas,
  propertyAreaEntries,
  STEWARD_TO_KVV_AREA,
}

export function getAllPropertyAreas(): PropertyAreaEntry[] {
  // Beräkna kvvArea dynamiskt baserat på stewardRefNr
  return propertyAreaEntries.map((entry) => ({
    ...entry,
    kvvArea: getKvvArea(entry.stewardRefNr),
  }))
}

export function getUniqueCostCenters(): string[] {
  const costCenters = new Set(propertyAreaEntries.map((e) => e.costCenter))
  return Array.from(costCenters).sort()
}

export function getUniqueStewards(): {
  name: string
  refNr: string
  phone?: string
}[] {
  const stewardMap = new Map<
    string,
    { name: string; refNr: string; phone?: string }
  >()
  propertyAreaEntries.forEach((e) => {
    if (!stewardMap.has(e.stewardRefNr)) {
      stewardMap.set(e.stewardRefNr, {
        name: e.stewardName,
        refNr: e.stewardRefNr,
        phone: e.stewardPhone,
      })
    }
  })
  return Array.from(stewardMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'sv')
  )
}

export function getUniqueBuildingTypes(): string[] {
  const types = new Set(
    propertyAreaEntries.map((e) => e.buildingType).filter(Boolean) as string[]
  )
  return Array.from(types).sort()
}

export function getCostCenterName(code: string): string {
  return COST_CENTER_NAMES[code] || code
}

export function getBuildingTypeName(code: string): string {
  return BUILDING_TYPES[code] || code
}

export function getDistrictManagers(
  costCenter: string
): DistrictManagers | undefined {
  return DISTRICT_MANAGERS[costCenter]
}
