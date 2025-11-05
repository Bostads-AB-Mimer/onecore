import { Lease, Contact, LeaseStatus } from '@onecore/types'
import { calculateRentInfo } from './rent-calculation'

const calculateStatus = (
  lastDebitDateString: string,
  startDateString: string
): LeaseStatus => {
  const leaseStartDate = new Date(startDateString)
  const leaseLastDebitDate = new Date(lastDebitDateString)
  const today = new Date()

  leaseStartDate.setHours(0, 0, 0, 0)
  leaseLastDebitDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  if (lastDebitDateString && leaseLastDebitDate >= today)
    return LeaseStatus.AboutToEnd
  else if (lastDebitDateString && leaseLastDebitDate < today)
    return LeaseStatus.Ended
  else if (leaseStartDate >= today) return LeaseStatus.Upcoming
  else {
    return LeaseStatus.Current
  }
}

const toLease = (
  row: any,
  tenantContactIds: string[] | undefined,
  tenants: Contact[] | undefined
): Lease => {
  const parsedLeaseId = row.leaseId.split('/')
  const rentalPropertyId = parsedLeaseId[0]
  const leaseNumber = parsedLeaseId[1]

  const lease = {
    leaseId: row.leaseId,
    leaseNumber: leaseNumber,
    rentalPropertyId: rentalPropertyId,
    type: row.leaseType,
    leaseStartDate: row.fromDate,
    leaseEndDate: row.toDate,
    status: calculateStatus(row.lastDebitDate, row.fromDate),
    tenantContactIds,
    tenants,
    rentalProperty: undefined,
    rentInfo: calculateRentInfo(row.yearrentrows),
    address: undefined,
    noticeGivenBy: row.noticeGivenBy,
    noticeDate: row.noticeDate,
    noticeTimeTenant: row.noticeTimeTenant,
    preferredMoveOutDate: row.preferredMoveOutDate,
    terminationDate: row.terminationDate,
    contractDate: row.contractDate,
    lastDebitDate: row.lastDebitDate,
    approvalDate: row.approvalDate,
  }

  return lease
}

export default { toLease }
