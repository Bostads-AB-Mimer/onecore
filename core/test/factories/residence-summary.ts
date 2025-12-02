import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const ResidenceSummaryFactory = Factory.define<
  components['schemas']['ResidenceSummary']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
  code: `010${sequence}`,
  name: 'Adressgatan 123',
  deleted: false,
  rentalId: `rental-${sequence}`,
  buildingCode: `202-00${sequence}`,
  buildingName: 'Building Name',
  staircaseCode: `A${sequence}`,
  staircaseName: 'Staircase A',
  elevator: 1,
  floor: '2',
  hygieneFacility: null,
  wheelchairAccessible: 0,
  validityPeriod: {
    fromDate: '2024-10-01T00:00:00Z',
    toDate: '2025-10-01T00:00:00Z',
  },
  residenceType: {
    code: '101',
    name: '1 RoK',
    roomCount: 1,
    kitchen: 1,
  },
  quantityValues: [
    {
      value: 35.5,
      quantityTypeId: 'qty-1',
      quantityType: {
        name: 'Area',
        unitId: 'm2',
      },
    },
  ],
}))
