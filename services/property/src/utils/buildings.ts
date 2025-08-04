import { BuildingWithRelations } from '@src/adapters/building-adapter'
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
 */
export function transformBuildingData(
  building: BuildingWithRelations
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
    deleted: Boolean(building.deleteMark),
  }
}
