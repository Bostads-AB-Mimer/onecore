import { logger } from '@onecore/utilities'

import { xpandDb } from './xpandDb'

// Tenfast/xpand document type code for signed contracts ("DO_SLUTF").
const SIGNED_CONTRACT_KEYDOTYP = '_4HQ0MIK0R8SLEU'

type SignedContract = {
  filename: string
  content: Buffer
}

const decodeFildata = (raw: unknown): Buffer | null => {
  if (raw == null) return null
  if (Buffer.isBuffer(raw)) return raw
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, '')
  // xpand stores file bytes as hex in dofil.fildata (filtype=1).
  if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
    return Buffer.from(cleaned, 'hex')
  }
  if (/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    const buf = Buffer.from(cleaned, 'base64')
    if (buf.length > 0) return buf
  }
  return null
}

/**
 * Fetches the signed contract PDF for an xpand lease.
 *
 * Modern (post-2021) signed contracts are linked via `dorev.dok LIKE
 * '<leaseId>%'` with `keydotyp = SIGNED_CONTRACT_KEYDOTYP`. Older leases used
 * the `hydis` junction (now defunct). Returns the first matching document by
 * skapdat ascending — at the moment of an Undertecknat sync the contract is
 * typically the only doc that exists for the lease.
 *
 * Returns null when no document is stored in xpand (e.g. pre-digital-signing
 * leases, or rentals where the PDF lives elsewhere). Callers should treat
 * that as a best-effort miss, not a failure.
 */
export const getSignedContractPdf = async (
  leaseId: string
): Promise<SignedContract | null> => {
  const dorevRows = (await xpandDb('dorev')
    .where('keydotyp', SIGNED_CONTRACT_KEYDOTYP)
    .andWhereLike('dok', `${leaseId}%`)
    .orderBy('skapdat', 'asc')
    .select('keydorev', 'path')) as Array<{
    keydorev: string
    path: string | null
  }>

  if (!dorevRows.length) {
    logger.warn({ leaseId }, 'getSignedContractPdf: no dorev row for lease')
    return null
  }

  for (const dorev of dorevRows) {
    const files = (await xpandDb('dofil')
      .where({ keydorev: dorev.keydorev })
      .select('fildata')) as Array<{ fildata: string | null }>
    for (const file of files) {
      const content = decodeFildata(file.fildata)
      if (!content) continue
      const filename = (dorev.path ?? `${leaseId}.pdf`).trim()
      return { filename, content }
    }
  }

  logger.warn(
    { leaseId },
    'getSignedContractPdf: dorev rows found but no decodable file content'
  )
  return null
}
