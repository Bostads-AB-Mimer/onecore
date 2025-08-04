import { LeaseStatus } from 'onecore-types'

import { calculateResidenceStatus } from '../calculate-residence-status'
import * as factory from '../../../../test/factories'

describe(calculateResidenceStatus, () => {
  it('returns "LEASED" when lease status is "Current", "Upcoming" or "AboutToEnd"', () => {
    expect(
      calculateResidenceStatus([
        factory.lease.build({ status: LeaseStatus.Current }),
      ])
    ).toBe('LEASED')

    expect(
      calculateResidenceStatus([
        factory.lease.build({ status: LeaseStatus.Upcoming }),
      ])
    ).toBe('LEASED')

    expect(
      calculateResidenceStatus([
        factory.lease.build({ status: LeaseStatus.AboutToEnd }),
      ])
    ).toBe('LEASED')
  })

  it('returns "VACANT" when lease status is "Ended"', () => {
    const leases = [factory.lease.build({ status: LeaseStatus.Ended })]
    const status = calculateResidenceStatus(leases)
    expect(status).toBe('VACANT')
  })
})
