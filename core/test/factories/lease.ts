import { Factory } from 'fishery'
import { Lease, LeaseStatus } from '@onecore/types'
import { components } from '../../src/adapters/work-order-adapter/generated/api-types'

export const LeaseFactory = Factory.define<Lease>(({ sequence }) => ({
  leaseId: `123-456-789/${sequence}`,
  address: {
    street: 'Gatustigen',
    number: '123',
    city: 'Västerås',
    postalCode: '12345',
  },
  approvalDate: undefined,
  contractDate: undefined,
  lastDebitDate: undefined,
  leaseEndDate: undefined,
  leaseNumber: '123',
  leaseStartDate: new Date(),
  noticeDate: undefined,
  noticeGivenBy: 'tenant',
  noticeTimeTenant: '',
  preferredMoveOutDate: undefined,
  rentalProperty: undefined,
  rentalPropertyId: '123-456-789',
  status: LeaseStatus.Current,
  tenantContactIds: ['P12345'],
  tenants: undefined,
  terminationDate: undefined,
  type: 'Bostadskontrakt',
  rentRows: [],
}))

export const WorkOrderLeaseFactory = Factory.define<
  components['schemas']['Lease']
>(({ sequence }) => ({
  leaseId: `123-456-789/${sequence}`,
  address: {
    street: 'Gatustigen',
    number: '123',
    city: 'Västerås',
    postalCode: '12345',
  },
  approvalDate: undefined,
  contractDate: undefined,
  lastDebitDate: undefined,
  leaseEndDate: undefined,
  leaseNumber: '123',
  leaseStartDate: new Date().toISOString(),
  noticeDate: undefined,
  noticeGivenBy: 'tenant',
  noticeTimeTenant: '',
  preferredMoveOutDate: undefined,
  rentalProperty: undefined,
  rentalPropertyId: '123-456-789',
  rentInfo: {
    currentRent: {
      currentRent: 123,
      additionalChargeAmount: undefined,
      additionalChargeDescription: undefined,
      rentEndDate: undefined,
      rentStartDate: undefined,
      vat: 0,
    },
    futureRents: undefined,
  },
  status: LeaseStatus.Current,
  tenantContactIds: ['P12345'],
  tenants: undefined,
  terminationDate: undefined,
  type: 'Bostadskontrakt',
}))
