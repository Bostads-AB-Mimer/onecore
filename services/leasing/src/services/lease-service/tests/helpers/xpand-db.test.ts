import transformFromXPandDb from '../../helpers/xpand-db'
import { LeaseStatus } from '@onecore/types'

describe(transformFromXPandDb.toLease, () => {
  it('should set status to Current for lease without lastDebitDate that starts in the past ', () => {
    const dbRow = {
      leaseId: '706-706-00-0012/07',
      leaseType: 'P-Platskontrakt               ',
      noticeGivenBy: null,
      contractDate: '2024-06-05T00:00:00.000Z',
      lastDebitDate: null,
      approvalDate: '2024-06-05T00:00:00.000Z',
      noticeDate: null,
      fromDate: '2024-06-05T00:00:00.000Z',
      toDate: null,
      noticeTimeTenant: 3,
      preferredMoveOutDate: null,
      terminationDate: null,
    }

    const lease = transformFromXPandDb.toLease(dbRow, undefined, undefined)

    expect(lease.status).toBe(LeaseStatus.Current)
  })
  it('should set status to Upcoming for lease without lastDebitDate that starts in the future', () => {
    const futureDate = new Date()
    futureDate.setMonth(new Date().getMonth() + 1)

    const dbRow = {
      leaseId: '711-002-02-0203/03',
      leaseType: 'Bostadskontrakt               ',
      noticeGivenBy: null,
      contractDate: '2024-08-28T00:00:00.000Z',
      lastDebitDate: null,
      approvalDate: '2024-08-28T00:00:00.000Z',
      noticeDate: null,
      fromDate: futureDate.toString(),
      toDate: null,
      noticeTimeTenant: 3,
      preferredMoveOutDate: null,
      terminationDate: null,
    }

    const lease = transformFromXPandDb.toLease(dbRow, undefined, undefined)

    expect(lease.status).toBe(LeaseStatus.Upcoming)
  })
  it('should set status to Upcoming for lease without lastDebitDate that starts today', () => {
    const today = new Date()

    const dbRow = {
      leaseId: '711-002-02-0203/03',
      leaseType: 'Bostadskontrakt               ',
      noticeGivenBy: null,
      contractDate: '2024-08-28T00:00:00.000Z',
      lastDebitDate: null,
      approvalDate: '2024-08-28T00:00:00.000Z',
      noticeDate: null,
      fromDate: today.toString(),
      toDate: null,
      noticeTimeTenant: 3,
      preferredMoveOutDate: null,
      terminationDate: null,
    }

    const lease = transformFromXPandDb.toLease(dbRow, undefined, undefined)

    expect(lease.status).toBe(LeaseStatus.Upcoming)
  })
  it('should set status to AboutToEnd for lease with a lastDebitDate today', () => {
    const today = new Date()

    const dbRow = {
      leaseId: '705-022-04-0201/11',
      leaseType: 'Bostadskontrakt               ',
      noticeGivenBy: 'G',
      contractDate: '2024-02-01T00:00:00.000Z',
      lastDebitDate: today.toString(),
      approvalDate: '2024-02-01T00:00:00.000Z',
      noticeDate: '2024-08-28T00:00:00.000Z',
      fromDate: '2024-03-01T00:00:00.000Z',
      toDate: null,
      noticeTimeTenant: 3,
      preferredMoveOutDate: '2024-11-30T00:00:00.000Z',
      terminationDate: null,
    }

    const lease = transformFromXPandDb.toLease(dbRow, undefined, undefined)

    expect(lease.status).toBe(LeaseStatus.AboutToEnd)
  })
  it('should set status to AboutToEnd for lease with a lastDebitDate in the future', () => {
    const futureDate = new Date()
    futureDate.setMonth(new Date().getMonth() + 1)

    const dbRow = {
      leaseId: '705-022-04-0201/11',
      leaseType: 'Bostadskontrakt               ',
      noticeGivenBy: 'G',
      contractDate: '2024-02-01T00:00:00.000Z',
      lastDebitDate: futureDate.toString(),
      approvalDate: '2024-02-01T00:00:00.000Z',
      noticeDate: '2024-08-28T00:00:00.000Z',
      fromDate: '2024-03-01T00:00:00.000Z',
      toDate: null,
      noticeTimeTenant: 3,
      preferredMoveOutDate: '2024-11-30T00:00:00.000Z',
      terminationDate: null,
    }

    const lease = transformFromXPandDb.toLease(dbRow, undefined, undefined)

    expect(lease.status).toBe(LeaseStatus.AboutToEnd)
  })
  it('should set status to Ended for a lease with a lastDebit date in the past', () => {
    const pastDate = new Date()
    pastDate.setMonth(new Date().getMonth() - 1)

    const dbRow = {
      leaseId: '705-022-04-0201/11',
      leaseType: 'Bostadskontrakt               ',
      noticeGivenBy: 'G',
      contractDate: '2024-02-01T00:00:00.000Z',
      lastDebitDate: pastDate.toString(),
      approvalDate: '2024-02-01T00:00:00.000Z',
      noticeDate: '2024-08-28T00:00:00.000Z',
      fromDate: '2024-03-01T00:00:00.000Z',
      toDate: null,
      noticeTimeTenant: 3,
      preferredMoveOutDate: '2024-11-30T00:00:00.000Z',
      terminationDate: null,
    }

    const lease = transformFromXPandDb.toLease(dbRow, undefined, undefined)

    expect(lease.status).toBe(LeaseStatus.Ended)
  })
})
