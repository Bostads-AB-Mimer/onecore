import { logger } from '@onecore/utilities'

import {
  LeaseDocumentMeta,
  pickContractDocument,
  pickTerminationDocument,
} from '../../helpers/lease-document-classification'
import { xpandDb } from './xpandDb'

// Tenfast/xpand document type code for signed contracts ("DO_SLUTF").
const SIGNED_CONTRACT_KEYDOTYP = '_4HQ0MIK0R8SLEU'
// DOKOP couples documents to other entities; CONTYPE 4 is the lease (hyobj) link.
// See sync-lease-documents (AVTAL-112 / PR #743).
const LEASE_CONTEXT_TYPE = 4

type LeaseDocument = {
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

const documentUploadFilename = (document: LeaseDocumentMeta): string => {
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

const fetchLeaseDocumentMeta = async (
  leaseId: string
): Promise<LeaseDocumentMeta[]> => {
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

const fetchDocumentContent = async (
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

const getSignedContractPdfByKeydotyp = async (
  leaseId: string
): Promise<LeaseDocument | null> => {
  const dorevRows = (await xpandDb('dorev')
    .where('keydotyp', SIGNED_CONTRACT_KEYDOTYP)
    .andWhereLike('dok', `${leaseId}%`)
    .orderBy('skapdat', 'asc')
    .select('keydorev', 'path')) as Array<{
    keydorev: string
    path: string | null
  }>

  for (const dorev of dorevRows) {
    const content = await fetchDocumentContent(dorev.keydorev)
    if (!content) continue
    const filename = (dorev.path ?? `${leaseId}.pdf`).trim()
    return { filename, content }
  }

  return null
}

/**
 * Fetches the signed contract PDF for an xpand lease.
 *
 * Uses the same title-based contract tiers as sync-lease-documents (AVTAL-112):
 * contract-titled documents, then Scrive kontrakt-bilaga bundles, then scanned
 * object-number titles confirmed via PDF inspection. Falls back to the DO_SLUTF
 * keydotyp link used by xpand's digital signing flow.
 */
export const getSignedContractPdf = async (
  leaseId: string
): Promise<LeaseDocument | null> => {
  try {
    const documents = await fetchLeaseDocumentMeta(leaseId)
    if (documents.length) {
      const contentByKeydorev = new Map<string, Buffer>()
      for (const document of documents) {
        const content = await fetchDocumentContent(document.keydorev)
        if (content) contentByKeydorev.set(document.keydorev, content)
      }

      const picked = pickContractDocument(leaseId, documents, contentByKeydorev)
      if (picked) {
        const content = contentByKeydorev.get(picked.keydorev)
        if (content) {
          return { filename: documentUploadFilename(picked), content }
        }
      }
    }

    const fallback = await getSignedContractPdfByKeydotyp(leaseId)
    if (fallback) return fallback

    logger.warn({ leaseId }, 'getSignedContractPdf: no contract document found')
    return null
  } catch (err) {
    logger.error({ err, leaseId }, 'getSignedContractPdf failed')
    return null
  }
}

/**
 * Fetches the operative uppsägning PDF for an xpand lease.
 *
 * Selection mirrors sync-lease-documents (AVTAL-112): newest actual uppsägning,
 * with tenant-signed bekräftelse as fallback when the digital flow produced
 * nothing else.
 */
export const getTerminationDocumentPdf = async (
  leaseId: string
): Promise<LeaseDocument | null> => {
  try {
    const documents = await fetchLeaseDocumentMeta(leaseId)
    const picked = pickTerminationDocument(documents)
    if (!picked) {
      logger.warn(
        { leaseId },
        'getTerminationDocumentPdf: no uppsägning document found'
      )
      return null
    }

    const content = await fetchDocumentContent(picked.keydorev)
    if (!content) {
      logger.warn(
        { leaseId, keydorev: picked.keydorev },
        'getTerminationDocumentPdf: document has no decodable file content'
      )
      return null
    }

    return { filename: documentUploadFilename(picked), content }
  } catch (err) {
    logger.error({ err, leaseId }, 'getTerminationDocumentPdf failed')
    return null
  }
}
