import { Factory } from 'fishery'
import { CreateComponentCategory } from '../../types/component-category'

export const ComponentCategoryFactory = Factory.define<CreateComponentCategory>(
  ({ sequence }) => ({
    categoryName: `Test Category ${sequence}`,
    description: `Test category description ${sequence}`,
  })
)
