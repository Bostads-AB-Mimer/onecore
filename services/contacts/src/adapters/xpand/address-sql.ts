import knex from 'knex'

/**
 * The contact's current fakturaadress — at most one row.
 *
 * Only `adrfakt`, never `adrpost` and no fallback to it.
 *
 * `tdate IS NULL` is "has no end date", not "valid today" — alone it admits
 * an address not yet in effect and drops the one in force once a successor
 * exists. NULL `fdate` means unbounded start.
 *
 * Latest registration wins: a move should stamp the predecessor's `tdate`, and
 * where that was missed the later `fdate` is the real address.
 *
 * Fresh `Raw` per call — bindings are single-use.
 */
export const currentInvoiceAddress = (db: knex.Knex) =>
  db.raw(
    `cmadr.keycmadr = (
       SELECT TOP 1 latest.keycmadr
       FROM cmadr latest
       WHERE latest.keycode = cmadr.keycode
         AND latest.keycmtyp = ?
         AND (latest.fdate IS NULL OR latest.fdate <= CAST(GETDATE() AS DATE))
         AND (latest.tdate IS NULL OR latest.tdate >= CAST(GETDATE() AS DATE))
       ORDER BY CASE WHEN latest.fdate IS NULL THEN 0 ELSE 1 END DESC,
                latest.fdate DESC,
                latest.keycmadr DESC
     )`,
    ['adrfakt']
  )
