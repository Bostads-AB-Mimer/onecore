import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const BuildingFactory = Factory.define<
  components['schemas']['Building']
>(({ sequence }) => ({
  id: `building-${sequence}`,
  code: `123-12${sequence}`,
  name: 'Test Building',
  buildingType: {
    id: 'type-1',
    code: `T00${sequence}`,
    name: 'Test Building',
  },
  construction: {
    constructionYear: 2020,
    renovationYear: 1999,
    valueYear: null,
  },
  features: {
    heating: null,
    fireRating: null,
  },
  insurance: {
    class: null,
    value: null,
  },
  deleted: false,
  property: null,
}))
