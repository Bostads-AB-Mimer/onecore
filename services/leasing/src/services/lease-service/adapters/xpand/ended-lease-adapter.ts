import { Knex } from 'knex'
import { Lease, LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { AdapterResult } from '../types'
import { xpandDb } from './xpandDb'
import { XPAND_HYOBT_AVTALSMALL } from './lease-search-adapter'
import { trimRow } from '../utils'
import transformFromXPandDb from '../../helpers/transformFromXPandDb'

const baseQuery = (): Knex.QueryBuilder => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return xpandDb
    .from('hyobj')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyhav.hyhavben as leaseType',
      'hyobj.uppsagtav as noticeGivenBy',
      'hyobj.avtalsdat as contractDate',
      'hyobj.sistadeb as lastDebitDate',
      'hyobj.godkdatum as approvalDate',
      'hyobj.uppsdatum as noticeDate',
      'hyobj.fdate as fromDate',
      'hyobj.tdate as toDate',
      'hyobj.uppstidg as noticeTimeTenant',
      'hyobj.onskflytt as preferredMoveOutDate',
      'hyobj.makuldatum as terminationDate',
      'cmctc.cmctckod as contactCode'
    )
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .innerJoin('hyavk', function () {
      this.on('hyavk.keyhyobj', '=', 'hyobj.keyhyobj').andOn(
        'hyavk.keyhyakt',
        '=',
        xpandDb.raw('?', ['INNEHAVARE'])
      )
    })
    .innerJoin('cmctc', 'cmctc.keycmctc', 'hyavk.keycmctc')
    .where('hyobj.deletemark', 0)
    .whereNot('hyobj.keyhyobt', XPAND_HYOBT_AVTALSMALL)
    .whereNot('hyobj.hyobjben', 'like', '%M%')
    .whereNull('hyobj.makuldatum')
    .whereNotNull('hyobj.sistadeb')
    .where('hyobj.sistadeb', '<', today)
}

type EndedLeaseRow = {
  leaseId: string
  leaseType: string | null
  noticeGivenBy: string | null
  contractDate: Date | null
  lastDebitDate: Date | null
  approvalDate: Date | null
  noticeDate: Date | null
  fromDate: Date | null
  toDate: Date | null
  noticeTimeTenant: string | null
  preferredMoveOutDate: Date | null
  terminationDate: Date | null
  contactCode: string | null
}

// The shared Lease schemas reject null, so SQL NULLs must become undefined.
const nullsToUndefined = (row: EndedLeaseRow): EndedLeaseRow =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value ?? undefined])
  ) as EndedLeaseRow

// One row per lease and holder; fold the holders into tenantContactIds.
const toLeases = (rows: EndedLeaseRow[]): Lease[] => {
  const byLeaseId = new Map<
    string,
    { row: EndedLeaseRow; contactIds: string[] }
  >()

  for (const raw of rows) {
    const row = nullsToUndefined(trimRow(raw))
    const entry = byLeaseId.get(row.leaseId)
    if (entry) {
      if (row.contactCode) entry.contactIds.push(row.contactCode)
    } else {
      byLeaseId.set(row.leaseId, {
        row,
        contactIds: row.contactCode ? [row.contactCode] : [],
      })
    }
  }

  return [...byLeaseId.values()].map(({ row, contactIds }) => ({
    ...transformFromXPandDb.toLease(row, contactIds, []),
    status: LeaseStatus.Ended,
  }))
}

export const getEndedLeasesByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Lease[], unknown>> => {
  try {
    // Select every lease the contact holds, so co-holders stay in tenantContactIds.
    const rows: EndedLeaseRow[] = await baseQuery().whereIn(
      'hyobj.keyhyobj',
      function () {
        this.select('hyavk.keyhyobj')
          .from('hyavk')
          .innerJoin('cmctc as holder', 'holder.keycmctc', 'hyavk.keycmctc')
          .where('hyavk.keyhyakt', 'INNEHAVARE')
          .where('holder.cmctckod', contactCode)
      }
    )
    return { ok: true, data: toLeases(rows) }
  } catch (err) {
    logger.error({ err }, 'ended-lease-adapter.getEndedLeasesByContactCode')
    return { ok: false, err }
  }
}

export const getEndedLeasesByRentalObjectCode = async (
  rentalObjectCode: string
): Promise<AdapterResult<Lease[], unknown>> => {
  try {
    const rows: EndedLeaseRow[] = await baseQuery()
      .innerJoin('hykop', function () {
        this.on('hykop.keyhyobj', '=', 'hyobj.keyhyobj').andOn(
          'hykop.ordning',
          '=',
          xpandDb.raw('?', [1])
        )
      })
      .innerJoin('babuf', 'babuf.keycmobj', 'hykop.keycmobj')
      .where('babuf.hyresid', rentalObjectCode)
    return { ok: true, data: toLeases(rows) }
  } catch (err) {
    logger.error(
      { err },
      'ended-lease-adapter.getEndedLeasesByRentalObjectCode'
    )
    return { ok: false, err }
  }
}

export const getEndedLeaseById = async (
  leaseId: string
): Promise<
  { ok: true; data: Lease } | { ok: false; err: 'not-found' | 'unknown' }
> => {
  try {
    const rows: EndedLeaseRow[] = await baseQuery().where(
      'hyobj.hyobjben',
      leaseId
    )
    const [lease] = toLeases(rows)
    return lease ? { ok: true, data: lease } : { ok: false, err: 'not-found' }
  } catch (err) {
    logger.error({ err }, 'ended-lease-adapter.getEndedLeaseById')
    return { ok: false, err: 'unknown' }
  }
}
