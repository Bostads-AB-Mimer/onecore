import { Factory } from 'fishery'

import { components } from '../../src/adapters/inspection-adapter/generated/api-types'

export const XpandInspectionFactory = Factory.define<
  components['schemas']['XpandInspection']
>(({ sequence }) => ({
  id: `INS${sequence}`,
  status: 'completed',
  date: new Date('2024-01-01').toISOString(),
  inspector: 'John Doe',
  type: 'move-in',
  address: '123 Main St',
  apartmentCode: `A${sequence}`,
  leaseId: `lease-${sequence}`,
}))
