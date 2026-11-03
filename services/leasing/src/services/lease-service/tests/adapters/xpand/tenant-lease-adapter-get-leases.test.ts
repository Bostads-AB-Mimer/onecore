import * as tenantLeaseAdapter from '../../../adapters/xpand/tenant-lease-adapter'
import { xpandDb } from '../../../adapters/xpand/xpandDb'

const mockRows = [
  {
    leaseId: '123-456-789/01',
    leaseType: 'Bostadskontrakt',
    fromDate: undefined,
    toDate: undefined,
    lastDebitDate: undefined,
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: undefined,
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: undefined,
    approvalDate: undefined,
    totalYearRent: undefined,
  },
]

jest.mock('knex', () => () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  then: (resolve: (rows: unknown[]) => unknown) => resolve(mockRows),
}))

describe('getLeases', () => {
  it('queries hyobj.hyobjben via a parameterized whereIn, not raw string interpolation', async () => {
    const leaseIds = ['123-456-789/01', "o'brien/02"]

    const result = await tenantLeaseAdapter.getLeases(leaseIds)

    expect(xpandDb.whereIn).toHaveBeenCalledWith('hyobj.hyobjben', leaseIds)
    expect(result).toHaveLength(1)
    expect(result[0].leaseId).toBe('123-456-789/01')
  })
})
