import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const CompanyFactory = Factory.define<components['schemas']['Company']>(
  ({ sequence }) => ({
    id: `company-${sequence}`,
    propertyObjectId: `PROP-${sequence}`,
    code: `code-${sequence}`,
    name: `CO_${sequence}`,
    organizationNumber: `ORG_${sequence}`,
  })
)
