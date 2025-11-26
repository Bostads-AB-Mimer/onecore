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
    rentalBlocks: [
      {
        id: 'block-1',
        blockReasonId: 'reason-1',
        blockReason: 'Underhållsarbete',
        fromDate: '2024-11-01T00:00:00Z',
        toDate: null,
        amount: null,
      },
    ],
  },
  property: { code: null, name: 'foo-property' },
  building: { code: null, name: 'foo-building' },
  malarEnergiFacilityId: '735999137000482621',
  size: 100,
}))

export const ResidenceByRentalIdDetailsFactory = Factory.define<
  components['schemas']['GetResidenceByRentalIdResponse']['content']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
  code: `010${sequence}`,
  name: 'Adressgatan 123',
  deleted: false,
  areaSize: 100,
  property: { id: 'test', code: '1001', name: 'foo-property' },
  building: { id: 'test', code: '2002', name: 'foo-building' },
  type: {
    kitchen: 1,
    code: '2RK',
    name: '2 rum och kök',
    roomCount: 2,
  },
  accessibility: { elevator: true, wheelchairAccessible: true },
  entrance: '1',
  features: { hygieneFacility: 'B' },
  rentalInformation: {
    apartmentNumber: '1',
    rentalId: '1234',
    type: { code: '1RK', name: '1 rum och kök' },
  },
  floor: '1',
  staircase: {
    id: 'staircase-1',
    code: 'A',
    name: 'Staircase A',
    features: {
      floorPlan: 'Plan A',
      accessibleByElevator: true,
    },
    dates: {
      from: '2024-01-01T00:00:00Z',
      to: '2025-12-31T23:59:59Z',
    },
    deleted: false,
    timestamp: '2024-01-01T00:00:00Z',
  },
}))
