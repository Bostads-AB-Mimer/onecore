import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const ResidenceDetailsFactory = Factory.define<
  components['schemas']['ResidenceDetails']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
  code: `010${sequence}`,
  name: 'Adressgatan 123',
  deleted: false,
  location: null,
  validityPeriod: {
    fromDate: '2024-10-01T00:00:00Z',
    toDate: '2025-10-01T00:00:00Z',
  },
  accessibility: {
    wheelchairAccessible: false,
    residenceAdapted: false,
    elevator: false,
  },
  features: {
    balcony1: {
      location: 'S',
      type: 'V',
    },
    patioLocation: 'S',
    hygieneFacility: 'B',
    sauna: false,
    extraToilet: false,
    sharedKitchen: false,
    petAllergyFree: false,
    electricAllergyIntolerance: false,
    smokeFree: false,
    asbestos: false,
  },
  floor: '1',
  residenceType: {
    residenceTypeId: 'string',
    code: '2RK',
    name: '2 rum och kök',
    roomCount: 2,
    kitchen: 1,
    systemStandard: 1,
    checklistId: null,
    componentTypeActionId: null,
    statisticsGroupSCBId: null,
    statisticsGroup2Id: null,
    statisticsGroup3Id: null,
    statisticsGroup4Id: null,
    timestamp: '_6QD0PIF66',
  },
  propertyObject: {
    energy: {
      energyClass: 1,
    },
    rentalId: null,
    rentalInformation: null,
  },
  property: { code: null, name: 'foo-property' },
  building: { code: null, name: 'foo-building' },
  malarEnergiFacilityId: '735999137000482621',
  size: 100,
}))
