import { PropertyAreaEntry } from '../types'

export interface GroupedPropertyEntry {
  id: string
  isGroup: boolean
  groupKey: string
  entries: PropertyAreaEntry[]
  // Aggregated data for display
  costCenter: string
  kvvArea?: string
  stewardName: string
  stewardRefNr: string
  stewardPhone?: string
  propertyCode: string
  propertyName: string
  addresses: string[]
  buildingType?: string
  residenceCount: number
  commercialCount: number
  garageCount: number
  parkingCount: number
  otherCount: number
  residenceArea: number
  commercialArea: number
  garageArea: number
  entranceCount: number
}

/**
 * Groups property entries by propertyCode + propertyName + buildingType
 * Only groups if there are multiple entries with the same combination
 */
export function groupPropertyEntries(
  entries: PropertyAreaEntry[]
): GroupedPropertyEntry[] {
  // Create groups based on propertyCode + propertyName + buildingType
  const groupMap = new Map<string, PropertyAreaEntry[]>()

  entries.forEach((entry) => {
    const groupKey = `${entry.propertyCode}-${entry.propertyName}-${entry.buildingType || 'none'}`
    const existing = groupMap.get(groupKey) || []
    existing.push(entry)
    groupMap.set(groupKey, existing)
  })

  // Convert groups to grouped entries
  const result: GroupedPropertyEntry[] = []

  groupMap.forEach((groupEntries, groupKey) => {
    if (groupEntries.length === 1) {
      // Single entry - no grouping needed
      const entry = groupEntries[0]
      result.push({
        id: entry.id,
        isGroup: false,
        groupKey,
        entries: groupEntries,
        costCenter: entry.costCenter,
        kvvArea: entry.kvvArea,
        stewardName: entry.stewardName,
        stewardRefNr: entry.stewardRefNr,
        stewardPhone: entry.stewardPhone,
        propertyCode: entry.propertyCode,
        propertyName: entry.propertyName,
        addresses: [entry.address],
        buildingType: entry.buildingType,
        residenceCount: entry.residenceCount || 0,
        commercialCount: entry.commercialCount || 0,
        garageCount: entry.garageCount || 0,
        parkingCount: entry.parkingCount || 0,
        otherCount: entry.otherCount || 0,
        residenceArea: entry.residenceArea || 0,
        commercialArea: entry.commercialArea || 0,
        garageArea: entry.garageArea || 0,
        entranceCount: entry.entranceCount || 0,
      })
    } else {
      // Multiple entries - create group with aggregated data
      const firstEntry = groupEntries[0]
      const aggregated: GroupedPropertyEntry = {
        id: `group-${groupKey}`,
        isGroup: true,
        groupKey,
        entries: groupEntries,
        costCenter: firstEntry.costCenter,
        kvvArea: firstEntry.kvvArea,
        stewardName: firstEntry.stewardName,
        stewardRefNr: firstEntry.stewardRefNr,
        stewardPhone: firstEntry.stewardPhone,
        propertyCode: firstEntry.propertyCode,
        propertyName: firstEntry.propertyName,
        addresses: [...new Set(groupEntries.map((e) => e.address))],
        buildingType: firstEntry.buildingType,
        residenceCount: 0,
        commercialCount: 0,
        garageCount: 0,
        parkingCount: 0,
        otherCount: 0,
        residenceArea: 0,
        commercialArea: 0,
        garageArea: 0,
        entranceCount: 0,
      }

      // Sum up all numeric values
      groupEntries.forEach((entry) => {
        aggregated.residenceCount += entry.residenceCount || 0
        aggregated.commercialCount += entry.commercialCount || 0
        aggregated.garageCount += entry.garageCount || 0
        aggregated.parkingCount += entry.parkingCount || 0
        aggregated.otherCount += entry.otherCount || 0
        aggregated.residenceArea += entry.residenceArea || 0
        aggregated.commercialArea += entry.commercialArea || 0
        aggregated.garageArea += entry.garageArea || 0
        aggregated.entranceCount += entry.entranceCount || 0
      })

      result.push(aggregated)
    }
  })

  return result
}
