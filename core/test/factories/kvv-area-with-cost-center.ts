import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const KvvAreaWithCostCenterFactory = Factory.define<
  components['schemas']['KvvAreaWithCostCenter']
>(({ sequence }) => ({
  id: `kvv-area-${sequence}`,
  code: `KVV${sequence}`,
  name: 'Test Kvv Area',
  costCenter: {
    id: `cost-center-${sequence}`,
    code: `CC${sequence}`,
    name: 'Test Cost Center',
  },
  responsibleKeycloakUserId: null,
}))
