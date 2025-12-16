import { Factory } from 'fishery'
import { XpandDbInspection } from '../../adapters/xpand-adapter'
import { XpandInspection } from '../../schemas'

export const XpandDbInspectionFactory = Factory.define<XpandDbInspection>(
  () => ({
    id: 'INSPECTION001',
    status: 1,
    date: new Date('2023-01-01T10:00:00Z'),
    inspector: 'INSPECTOR001',
    type: 'Type A',
    address: '123 Main St',
    apartmentCode: 'APT001',
    leaseId: 'LEASE001',
  })
)

export const XpandInspectionFactory = Factory.define<XpandInspection>(() => ({
  id: 'INSPECTION001',
  status: 'Genomförd',
  date: new Date('2023-01-01T10:00:00Z'),
  inspector: 'INSPECTOR001',
  type: 'Type A',
  address: '123 Main St',
  apartmentCode: 'APT001',
  leaseId: 'LEASE001',
}))
