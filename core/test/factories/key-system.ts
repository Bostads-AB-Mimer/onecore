import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeySystem = keys.v1.KeySystem

export const KeySystemFactory = Factory.define<KeySystem>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  systemCode: `SYS-${sequence}`,
  name: `Key System ${sequence}`,
  manufacturer: 'ASSA ABLOY',
  managingSupplier: 'Supplier AB',
  type: 'MECHANICAL',
  propertyIds: JSON.stringify(['property-1', 'property-2']),
  installationDate: new Date('2020-01-01'),
  isActive: true,
  description: `Description for system ${sequence}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user@mimer.nu',
  updatedBy: null,
}))
