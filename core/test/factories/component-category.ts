import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentCategoryFactory =
  Factory.define<schemas.ComponentCategory>(({ sequence }) => ({
    id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
    categoryName: `Category ${sequence}`,
    description: `Description for category ${sequence}`,
    type: 'EQUIPMENT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
