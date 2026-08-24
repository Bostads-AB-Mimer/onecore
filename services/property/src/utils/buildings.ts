import {
  BuildingProperty,
  BuildingWithRelations,
} from '@src/adapters/building-adapter'
import { Building } from '@src/types/building'

/**
 * Transforms a building entity with relations into a normalized building data object.
 *
 * @param building - The building entity with all its related data
 * @returns A transformed building object with normalized structure containing:
 *   - Basic info (id, code, name)
 *   - Building type details (id, code, name)
 *   - Construction information (construction year, renovation year, value year)
 *   - Building features (heating, fire rating)
 *   - Insurance details (class, value)
 *   - Deletion status
 *   - The property (fastighet) the building belongs to, when resolved
 */
export function transformBuildingData(
  building: BuildingWithRelations & { property?: BuildingProperty | null }
): Building {
  return {
    id: building.id,
    code: building.buildingCode,
    name: building.name || null,
    buildingType: {
      id: building.buildingType?.id || null,
      code: building.buildingType?.code || null,
      name: building.buildingType?.name || null,
    },
    construction: {
      constructionYear: building.constructionYear,
      renovationYear: building.renovationYear,
      valueYear: building.valueYear,
    },
    features: {
      heating: building.heating || null,
      fireRating: building.fireRating || null,
    },
    insurance: {
      class: building.insuranceClass,
      value: building.insuranceValue,
    },
    quantityValues:
      building.propertyObject?.quantityValues?.map((qv) => ({
        id: qv?.quantityType?.id,
        name: qv.quantityType?.name,
        unitId: qv.quantityType?.unitId,
        value: qv.value,
      })) || undefined,
    deleted: Boolean(building.deleteMark),
    // Only the detail lookups resolve the property. The list route does not, and
    // emitting `null` there would assert "belongs to no property" — wrong, since
    // those buildings were fetched *by* property code. Absent = not looked up.
    ...(building.property !== undefined ? { property: building.property } : {}),
  }
}
