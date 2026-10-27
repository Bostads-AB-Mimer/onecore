import type { BuildingWithRelations } from '../../adapters/building-adapter'
import { transformBuildingData } from '../../utils/buildings'

const baseBuilding = {
  id: 'BYG-1',
  buildingCode: '202-002',
  name: 'Hus A',
  propertyObjectId: 'CMOBJ-BYG-1',
  buildingType: { id: 'BT-1', code: 'BO', name: 'Bostadshus' },
  constructionYear: 1970,
  renovationYear: null,
  valueYear: null,
  heating: null,
  fireRating: null,
  insuranceClass: null,
  insuranceValue: null,
  deleteMark: 0,
  propertyObject: { quantityValues: [] },
} as unknown as BuildingWithRelations

describe('transformBuildingData', () => {
  it('maps the resolved property onto the building', () => {
    const result = transformBuildingData({
      ...baseBuilding,
      property: { id: 'FST-1', code: '01801', name: 'Kvarnen 1' },
    })

    expect(result.property).toEqual({
      id: 'FST-1',
      code: '01801',
      name: 'Kvarnen 1',
    })
  })

  it('returns property as null when the building has no resolved property', () => {
    const result = transformBuildingData({ ...baseBuilding, property: null })

    expect(result.property).toBeNull()
  })

  it('omits property entirely when it was never resolved', () => {
    // The list route (getBuildings) does not resolve the property. Emitting
    // `null` there would assert "has no property", which is wrong — those
    // buildings do belong to one. Absent means "not looked up".
    const result = transformBuildingData(baseBuilding)

    expect('property' in result).toBe(false)
  })
})
