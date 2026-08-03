import { communication } from '@onecore/types'

import {
  deriveDispatchStatus,
  deriveDispatchStatusFromCounts,
} from '../dispatch-status'

type RecipientStatus = communication.RecipientStatus

describe('deriveDispatchStatus', () => {
  it('scheduled when any recipient is scheduled', () => {
    expect(deriveDispatchStatus(['scheduled', 'delivered'])).toBe('scheduled')
  })
  it('cancelled only when all are cancelled', () => {
    expect(deriveDispatchStatus(['cancelled', 'cancelled'])).toBe('cancelled')
  })
  it('sending while any recipient is still pending/sent', () => {
    expect(deriveDispatchStatus(['pending', 'delivered'])).toBe('sending')
    expect(deriveDispatchStatus(['sent'])).toBe('sending')
  })
  it('delivered when all terminal and all delivered', () => {
    expect(deriveDispatchStatus(['delivered', 'delivered'])).toBe('delivered')
  })
  it('partially_delivered when some delivered, some failed/bounced', () => {
    expect(deriveDispatchStatus(['delivered', 'failed'])).toBe(
      'partially_delivered'
    )
    expect(deriveDispatchStatus(['delivered', 'bounced'])).toBe(
      'partially_delivered'
    )
  })
  it('partially_delivered for a delivered + cancelled mix (badge/filter parity)', () => {
    expect(deriveDispatchStatus(['delivered', 'cancelled'])).toBe(
      'partially_delivered'
    )
  })
  it('failed when all terminal and none delivered', () => {
    expect(deriveDispatchStatus(['failed', 'bounced'])).toBe('failed')
    expect(deriveDispatchStatus(['failed', 'cancelled'])).toBe('failed')
  })
  it('failed for an empty recipient set (edge)', () => {
    expect(deriveDispatchStatus([])).toBe('failed')
  })
})

// JS mirror of STATUS_PREDICATE_SQL in adapters/db.ts, expressed over the SET of
// present statuses (the SQL predicates are all EXISTS-based, so presence is what
// matters). These MUST stay identical to the SQL; the agreement test below
// fails if the SQL derivation and deriveDispatchStatusFromCounts ever diverge.
const SQL_MIRROR: Record<
  communication.DispatchStatus,
  (present: Set<RecipientStatus>) => boolean
> = {
  scheduled: (p) => p.has('scheduled'),
  cancelled: (p) => p.size > 0 && [...p].every((s) => s === 'cancelled'),
  sending: (p) =>
    !p.has('scheduled') &&
    (p.has('pending') || p.has('sent') || p.has('received')),
  delivered: (p) => p.size > 0 && [...p].every((s) => s === 'delivered'),
  partially_delivered: (p) =>
    !p.has('scheduled') &&
    !p.has('pending') &&
    !p.has('sent') &&
    !p.has('received') &&
    p.has('delivered') &&
    [...p].some((s) => s !== 'delivered'),
  failed: (p) =>
    !p.has('scheduled') &&
    !p.has('pending') &&
    !p.has('sent') &&
    !p.has('received') &&
    !p.has('delivered') &&
    (p.has('failed') || p.has('bounced')),
}

const DISPATCH_STATUSES = Object.keys(
  SQL_MIRROR
) as communication.DispatchStatus[]

describe('SQL status predicates agree with the JS derivation', () => {
  const all = communication.RECIPIENT_STATUS
  // Every subset of the 8 recipient statuses (2^8 = 256 combinations).
  for (let mask = 1; mask < 1 << all.length; mask++) {
    const present = all.filter((_, i) => mask & (1 << i))
    it(`present={${present.join(',')}}`, () => {
      const counts = Object.fromEntries(present.map((s) => [s, 1]))
      const derived = deriveDispatchStatusFromCounts(counts)

      const presentSet = new Set(present)
      const sqlMatches = DISPATCH_STATUSES.filter((st) =>
        SQL_MIRROR[st](presentSet)
      )

      // Exactly one SQL predicate matches, and it equals the JS derivation.
      expect(sqlMatches).toEqual([derived])
    })
  }
})
