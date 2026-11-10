import { LeaseStatus } from '@onecore/types'

import { mergeTenfastFirst } from '../../helpers/merge-tenfast-first'
import * as factory from '../factories'

describe('mergeTenfastFirst', () => {
  it('returns a lease present in both sources once, with the Tenfast version', () => {
    const tenfast = factory.lease.build({
      leaseId: '123-456-789/01',
      status: LeaseStatus.AboutToEnd,
    })
    const xpand = factory.lease.build({
      leaseId: '123-456-789/01',
      status: LeaseStatus.Ended,
    })

    const result = mergeTenfastFirst([tenfast], [xpand])

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe(LeaseStatus.AboutToEnd)
  })

  it('keeps the Tenfast lease whatever its status', () => {
    const tenfast = factory.lease.build({
      leaseId: '123-456-789/01',
      status: LeaseStatus.Ended,
    })
    const xpand = factory.lease.build({
      leaseId: '123-456-789/01',
      status: LeaseStatus.Ended,
      leaseStartDate: new Date('2001-01-01'),
    })

    const result = mergeTenfastFirst([tenfast], [xpand])

    expect(result).toEqual([tenfast])
  })

  it('keeps Xpand leases that Tenfast does not have', () => {
    const tenfast = factory.lease.build({ leaseId: '111-111-111/01' })
    const xpandOnly = factory.lease.build({
      leaseId: '222-222-222/02',
      status: LeaseStatus.Ended,
    })

    const result = mergeTenfastFirst([tenfast], [xpandOnly])

    expect(result.map((l) => l.leaseId)).toEqual([
      '111-111-111/01',
      '222-222-222/02',
    ])
  })

  it('matches ids that differ only by surrounding whitespace', () => {
    const tenfast = factory.lease.build({ leaseId: '123-456-789/01' })
    const xpand = factory.lease.build({ leaseId: '123-456-789/01   ' })

    const result = mergeTenfastFirst([tenfast], [xpand])

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(tenfast)
  })

  it('returns the Xpand leases when Tenfast has none', () => {
    const xpand = factory.lease.build({ leaseId: '222-222-222/02' })

    expect(mergeTenfastFirst([], [xpand])).toEqual([xpand])
  })
})
