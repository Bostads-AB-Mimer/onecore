import { Factory } from 'fishery'
import { Lease, LeaseStatus } from '@onecore/types'

import { leaseTypes } from '../../../../constants/leaseTypes'

export const LeaseFactory = Factory.define<Lease>(({ sequence }) => ({
  leaseId: `${sequence}`,
  leaseNumber: `0${sequence}`,
  leaseStartDate: new Date(2022, 1),
  leaseEndDate: undefined,
  status: LeaseStatus.Current,
  tenantContactIds: undefined,
  tenants: undefined,
  rentalPropertyId: `605-703-00-0014-${sequence}`,
  rentalProperty: undefined,
  type: leaseTypes.parkingspaceContract,
  rentInfo: undefined,
  address: {
    street: 'Testgatan',
    number: '123',
    postalCode: '723 40',
    city: 'Västerås',
  },
  noticeGivenBy: undefined,
  noticeDate: undefined,
  noticeTimeTenant: undefined,
  preferredMoveOutDate: undefined,
  terminationDate: undefined,
  contractDate: new Date(2021, 11),
  lastDebitDate: undefined,
  approvalDate: new Date(2021, 12),
  residentialArea: {
    code: 'MAL',
    caption: 'Malmaberg',
  },
  rentRows: [],
}))
