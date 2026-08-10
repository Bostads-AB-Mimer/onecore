import { communication } from '@onecore/types'

import {
  deriveDispatchStatus,
  deriveDispatchStatusFromCounts,
} from '../dispatch-status'

type RecipientStatus = communication.RecipientStatus

describe('deriveDispatchStatus', () => {
  it('scheduled when the send is in the future and a recipient is scheduled', () => {
    expect(deriveDispatchStatus(['scheduled', 'delivered'], true)).toBe(
      'scheduled'
    )
  })
  it('sending (not scheduled) once the send time has passed with a straggler', () => {
    expect(deriveDispatchStatus(['scheduled', 'delivered'], false)).toBe(
      'sending'
    )
    expect(deriveDispatchStatus(['scheduled'], false)).toBe('sending')
  })
  it('cancelled only when all are cancelled', () => {
    expect(deriveDispatchStatus(['cancelled', 'cancelled'], false)).toBe(
      'cancelled'
    )
  })
  it('sending while any recipient is still pending/sent', () => {
    expect(deriveDispatchStatus(['pending', 'delivered'], false)).toBe(
      'sending'
    )
    expect(deriveDispatchStatus(['sent'], false)).toBe('sending')
  })
  it('delivered when all terminal and all delivered', () => {
    expect(deriveDispatchStatus(['delivered', 'delivered'], false)).toBe(
      'delivered'
    )
  })
  it('partially_delivered for a delivered + failed/bounced/cancelled mix', () => {
    expect(deriveDispatchStatus(['delivered', 'failed'], false)).toBe(
      'partially_delivered'
    )
    expect(deriveDispatchStatus(['delivered', 'cancelled'], false)).toBe(
      'partially_delivered'
    )
  })
  it('failed when all terminal and none delivered', () => {
    expect(deriveDispatchStatus(['failed', 'bounced'], false)).toBe('failed')
    expect(deriveDispatchStatus(['failed', 'cancelled'], false)).toBe('failed')
  })
  it('failed for an empty recipient set (edge)', () => {
    expect(deriveDispatchStatus([], false)).toBe('failed')
  })
})

// JS mirror of STATUS_PREDICATE_SQL in adapters/db.ts, expressed over the SET of
// present statuses plus the sendAt-in-future flag (the SQL predicates are all
// EXISTS-based, so presence is what matters). These MUST stay identical to the
// SQL; the agreement test below fails if the SQL derivation and
// deriveDispatchStatusFromCounts ever diverge.
const SQL_MIRROR: Record<
  communication.DispatchStatus,
  (present: Set<RecipientStatus>, future: boolean) => boolean
> = {
  scheduled: (p, future) => future && p.has('scheduled'),
  cancelled: (p) => p.size > 0 && [...p].every((s) => s === 'cancelled'),
  sending: (p, future) =>
    !(future && p.has('scheduled')) &&
    (p.has('pending') ||
      p.has('sent') ||
      p.has('received') ||
      p.has('scheduled')),
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
  // Every non-empty subset of the 8 recipient statuses, in both sendAt windows.
  for (const future of [true, false]) {
    for (let mask = 1; mask < 1 << all.length; mask++) {
      const present = all.filter((_, i) => mask & (1 << i))
      it(`future=${future} present={${present.join(',')}}`, () => {
        const counts = Object.fromEntries(present.map((s) => [s, 1]))
        const derived = deriveDispatchStatusFromCounts(counts, future)

        const presentSet = new Set(present)
        const sqlMatches = DISPATCH_STATUSES.filter((st) =>
          SQL_MIRROR[st](presentSet, future)
        )

        // Exactly one SQL predicate matches, and it equals the JS derivation.
        expect(sqlMatches).toEqual([derived])
      })
    }
  }
})
