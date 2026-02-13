import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeySystem = keys.v1.KeySystem

export const KeySystemFactory = Factory.define<KeySystem>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
  systemCode: `SYS-${String(sequence).padStart(4, '0')}`,
  name: `Key System ${sequence}`,
  manufacturer: 'ASSA ABLOY',
  managingSupplier: undefined,
  type: 'MECHANICAL',
  propertyIds: undefined,
  installationDate: undefined,
  isActive: true,
  notes: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: undefined,
  updatedBy: undefined,
}))
