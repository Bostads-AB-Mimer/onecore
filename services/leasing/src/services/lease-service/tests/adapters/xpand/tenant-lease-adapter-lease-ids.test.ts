import * as tenantLeaseAdapter from '../../../adapters/xpand/tenant-lease-adapter'
import { xpandDb } from '../../../adapters/xpand/xpandDb'

let mockResult: Promise<unknown[]>

jest.mock('knex', () => () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  whereRaw: jest.fn().mockReturnThis(),
  then: (
    resolve: (rows: unknown[]) => unknown,
    reject: (err: unknown) => unknown
  ) => mockResult.then(resolve, reject),
}))

describe(tenantLeaseAdapter.getLeaseIdsByRentalObjectCode, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the trimmed ids of the leases whose id starts with the rental object code', async () => {
    mockResult = Promise.resolve([
      { leaseId: '704-703-00-0006/01   ' },
      { leaseId: '704-703-00-0006/04M' },
    ])

    const result =
      await tenantLeaseAdapter.getLeaseIdsByRentalObjectCode('704-703-00-0006')

    expect(result).toEqual({
      ok: true,
      data: ['704-703-00-0006/01', '704-703-00-0006/04M'],
    })
    // Cast to the column's VARCHAR type so SQL Server can use its index.
    expect(xpandDb.whereRaw).toHaveBeenCalledWith(
      'hyobj.hyobjben LIKE CAST(? AS VARCHAR(60))',
      ['704-703-00-0006/%']
    )
  })

  it('escapes LIKE wildcards in the rental object code', async () => {
    mockResult = Promise.resolve([])

    await tenantLeaseAdapter.getLeaseIdsByRentalObjectCode('A_B%C[D')

    expect(xpandDb.whereRaw).toHaveBeenCalledWith(expect.any(String), [
      'A[_]B[%]C[[]D/%',
    ])
  })

  it('returns "could-not-get-lease-ids" when the query fails', async () => {
    mockResult = Promise.reject(new Error('connection lost'))

    const result =
      await tenantLeaseAdapter.getLeaseIdsByRentalObjectCode('704-703-00-0006')

    expect(result).toEqual({ ok: false, err: 'could-not-get-lease-ids' })
  })
})
