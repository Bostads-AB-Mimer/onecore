import knex, { Knex } from 'knex'

import config from '../../common/config'

// DOKOP couples documents to other entities; CONTYPE 4 is the lease (hyobj)
// coupling. This is the authoritative lease-to-document link — dorev.dok only
// carries a lease id for some documents and a timestamp for the rest.
const LEASE_CONTEXT_TYPE = 4

export type XpandLeaseDocument = {
  leaseId: string
  keydorev: string
  dok: string
  title: string
  filename: string | null
  documentType: string
  createdAt: Date | null
  sortorder: number | null
}

export const createDbClient = (poolSize: number): Knex =>
  knex({
    client: 'mssql',
    connection: { ...config.xpandDatabase, requestTimeout: 600000 },
    pool: { min: 0, max: Math.max(poolSize + 1, 2) },
  })

/**
 * Every lease document in xpand, keyed by lease id. One pass over DOKOP is far
 * cheaper than a query per lease, and the whole set is only ~154k rows of
 * metadata.
 */
export const fetchAllLeaseDocuments = async (
  db: Knex
): Promise<Map<string, XpandLeaseDocument[]>> => {
  const rows = (await db('dokop as k')
    .join('hyobj as h', 'h.keyhyobj', 'k.keycode')
    .join('dorev as r', 'r.keydorev', 'k.keydorev')
    .leftJoin('dotyp as t', 't.keydotyp', 'r.keydotyp')
    .where('k.contype', LEASE_CONTEXT_TYPE)
    .whereNotNull('h.hyobjben')
    .select(
      'h.hyobjben as leaseId',
      'r.keydorev as keydorev',
      'r.dok as dok',
      'r.revben as title',
      'r.path as filename',
      't.caption as documentType',
      'r.skapdat as createdAt',
      'k.sortorder as sortorder'
    )) as Array<Record<string, unknown>>

  const byLease = new Map<string, XpandLeaseDocument[]>()
  for (const row of rows) {
    const leaseId = String(row.leaseId ?? '').trim()
    if (!leaseId) continue
    const document: XpandLeaseDocument = {
      leaseId,
      keydorev: String(row.keydorev ?? '').trim(),
      dok: String(row.dok ?? '').trim(),
      title: String(row.title ?? '').trim(),
      filename: row.filename ? String(row.filename).trim() : null,
      documentType: String(row.documentType ?? '').trim(),
      createdAt: row.createdAt ? new Date(row.createdAt as string) : null,
      sortorder: row.sortorder === null ? null : Number(row.sortorder),
    }
    byLease.set(leaseId, [...(byLease.get(leaseId) ?? []), document])
  }
  return byLease
}

const decodeFildata = (raw: unknown): Buffer | null => {
  if (raw == null) return null
  if (Buffer.isBuffer(raw)) return raw
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, '')
  if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
    return Buffer.from(cleaned, 'hex')
  }
  if (/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    const buf = Buffer.from(cleaned, 'base64')
    if (buf.length > 0) return buf
  }
  return null
}

export const fetchDocumentContent = async (
  db: Knex,
  keydorev: string
): Promise<Buffer | null> => {
  const files = (await db('dofil')
    .where({ keydorev })
    .select('fildata')) as Array<{ fildata: string | null }>

  for (const file of files) {
    const content = decodeFildata(file.fildata)
    if (content) return content
  }
  return null
}
