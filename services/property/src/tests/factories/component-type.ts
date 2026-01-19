import { Factory } from 'fishery'
import { CreateComponentType } from '../../types/component-type'

// Note: categoryId must be provided via .build({ categoryId }) since it's a FK
export const ComponentTypeFactory = Factory.define<CreateComponentType>(
  ({ sequence }) => ({
    typeName: `Test Type ${sequence}`,
    categoryId: '00000000-0000-0000-0000-000000000000', // Override with real ID
    description: `Test type description ${sequence}`,
  })
)
