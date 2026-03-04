import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const ResidenceDetailsFactory = Factory.define<
  components['schemas']['ResidenceDetails']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
  code: `010${sequence}`,
  name: 'Adressgatan 123',
  status: null,
  entrance: '1',
  location: null,
  floor: '1',
  partNo: null,
  part: null,
  deleted: false,
  validityPeriod: {
    fromDate: '2024-10-01T00:00:00Z',
    toDate: '2025-10-01T00:00:00Z',
  },
  accessibility: {
    wheelchairAccessible: false,
    elevator: false,
    residenceAdapted: false,
  },
  features: {
    hygieneFacility: 'B',
    balcony1: {
      location: 'S',
      type: 'V',
    },
    patioLocation: 'S',
    sauna: false,
    extraToilet: false,
    sharedKitchen: false,
    petAllergyFree: false,
    electricAllergyIntolerance: false,
    smokeFree: false,
    asbestos: false,
  },
  type: {
    code: '2RK',
    name: '2 rum och kök',
    roomCount: 2,
    kitchen: 1,
  },
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
  rentalInformation: {
    apartmentNumber: '1',
    rentalId: '1234',
    type: { code: '2RK', name: '2 rum och kök' },
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
  property: { id: null, code: null, name: 'foo-property' },
  building: { id: null, code: null, name: 'foo-building' },
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
  areaSize: 100,
  malarEnergiFacilityId: '735999137000482621',
}))

export const ResidenceByRentalIdDetailsFactory = ResidenceDetailsFactory
