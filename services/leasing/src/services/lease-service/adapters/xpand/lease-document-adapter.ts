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
  try {
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
  } catch (err) {
    logger.error({ err, leaseId }, 'getSignedContractPdf failed')
    return null
  }
}

// DOKOP couples documents to other entities; CONTYPE 4 is the lease (hyobj) link.
const LEASE_CONTEXT_TYPE = 4

type TerminationDocument = {
  filename: string
  content: Buffer
}

type TerminationDocumentMeta = {
  keydorev: string
  title: string
  filename: string | null
  createdAt: Date | null
}

const terminationUploadFilename = (document: TerminationDocumentMeta): string => {
  const UNSAFE = /[\\/:*?"<>|]/g
  const raw = (document.filename ?? '').trim() || document.title.trim()
  const cleaned = raw
    .replace(UNSAFE, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .replace(/^[._ ]+|[._ ]+$/g, '')
  const name = cleaned || document.keydorev
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`
}

const fetchTerminationDocumentMeta = async (
  leaseId: string
): Promise<TerminationDocumentMeta[]> => {
  const rows = (await xpandDb('dokop as k')
    .join('hyobj as h', 'h.keyhyobj', 'k.keycode')
    .join('dorev as r', 'r.keydorev', 'k.keydorev')
    .where('k.contype', LEASE_CONTEXT_TYPE)
    .where('h.hyobjben', leaseId)
    .select(
      'r.keydorev as keydorev',
      'r.revben as title',
      'r.path as filename',
      'r.skapdat as createdAt'
    )) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    keydorev: String(row.keydorev ?? '').trim(),
    title: String(row.title ?? '').trim(),
    filename: row.filename ? String(row.filename).trim() : null,
    createdAt: row.createdAt ? new Date(row.createdAt as string) : null,
  }))
}

const fetchTerminationDocumentContent = async (
  keydorev: string
): Promise<Buffer | null> => {
  const files = (await xpandDb('dofil')
    .where({ keydorev })
    .select('fildata')) as Array<{ fildata: string | null }>

  for (const file of files) {
    const content = decodeFildata(file.fildata)
    if (content) return content
  }
  return null
}

const isUppsagningTitle = (title: string): boolean => {
  const name = title.toLowerCase()
  return name.includes('uppsägning') || name.includes('uppsagning')
}

// Uppsägning-classified documents that are not the termination itself.
const NOT_THE_TERMINATION = [
  'bekräftelse',
  'bekraftelse',
  'ändring',
  'andring',
  'återtagen',
  'atertagen',
]

const isOperativeUppsagning = (title: string): boolean =>
  isUppsagningTitle(title) &&
  !NOT_THE_TERMINATION.some((word) => title.toLowerCase().includes(word))

const isUppsagningsbekraftelse = (title: string): boolean =>
  isUppsagningTitle(title) &&
  ['bekräftelse', 'bekraftelse'].some((word) =>
    title.toLowerCase().includes(word)
  )

const newestTerminationDocument = (
  documents: TerminationDocumentMeta[]
): TerminationDocumentMeta | null =>
  documents.length
    ? documents.reduce((best, document) =>
        (document.createdAt?.getTime() ?? 0) > (best.createdAt?.getTime() ?? 0)
          ? document
          : best
      )
    : null

const pickTerminationDocument = (
  documents: TerminationDocumentMeta[]
): TerminationDocumentMeta | null => {
  const actualUppsagningar = documents.filter((document) =>
    isOperativeUppsagning(document.title)
  )
  const candidates = actualUppsagningar.length
    ? actualUppsagningar
    : documents.filter((document) => isUppsagningsbekraftelse(document.title))

  return newestTerminationDocument(candidates)
}

/**
 * Fetches the operative uppsägning PDF for an xpand lease.
 *
 * Picks the newest actual uppsägning, with tenant-signed bekräftelse as
 * fallback when the digital flow produced nothing else.
 */
export const getTerminationDocumentPdf = async (
  leaseId: string
): Promise<TerminationDocument | null> => {
  try {
    const documents = await fetchTerminationDocumentMeta(leaseId)
    const picked = pickTerminationDocument(documents)
    if (!picked) {
      logger.warn(
        { leaseId },
        'getTerminationDocumentPdf: no uppsägning document found'
      )
      return null
    }

    const content = await fetchTerminationDocumentContent(picked.keydorev)
    if (!content) {
      logger.warn(
        { leaseId, keydorev: picked.keydorev },
        'getTerminationDocumentPdf: document has no decodable file content'
      )
      return null
    }

    return { filename: terminationUploadFilename(picked), content }
  } catch (err) {
    logger.error({ err, leaseId }, 'getTerminationDocumentPdf failed')
    return null
  }
}
