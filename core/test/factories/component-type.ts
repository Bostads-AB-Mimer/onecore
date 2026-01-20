import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentTypeFactory = Factory.define<schemas.ComponentType>(
  ({ sequence }) => ({
    id: `00000000-0000-0000-0001-${sequence.toString().padStart(12, '0')}`,
    typeName: `Type ${sequence}`,
    categoryId: '00000000-0000-0000-0000-000000000001',
    description: `Description for type ${sequence}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: undefined,
  })
)
