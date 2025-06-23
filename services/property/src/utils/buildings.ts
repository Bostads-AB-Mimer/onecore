import { BuildingWithRelations } from '@src/adapters/building-adapter'

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
export function transformBuildingData(building: BuildingWithRelations) {
  return {
    id: building.id,
    code: building.buildingCode,
    name: building.name || '',
    buildingType: {
      id: building.buildingType?.id || '',
      code: building.buildingType?.code || '',
      name: building.buildingType?.name || '',
    },
    construction: {
      constructionYear: building.constructionYear,
      renovationYear: building.renovationYear,
      valueYear: building.valueYear,
    },
    features: {
      heating: building.heating || '',
      fireRating: building.fireRating || '',
    },
    insurance: {
      class: building.insuranceClass,
      value: building.insuranceValue,
    },
    deleted: Boolean(building.deleteMark),
  }
}
