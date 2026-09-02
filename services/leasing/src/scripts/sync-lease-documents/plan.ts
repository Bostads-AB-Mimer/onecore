import path from 'path'

import { classifyDocument, pickContract } from './classification'
import type { TenfastLeaseSummary } from './tenfast-documents'
import type { XpandLeaseDocument } from './xpand-documents'

export type PdfTraits = { signed: boolean; isScan: boolean }

export type LeasePlan = {
  lease: TenfastLeaseSummary
  filenames: Map<string, string>
  contract: XpandLeaseDocument | null
  contractSkippedReason: string | null
  contractCandidates: XpandLeaseDocument[]
  needsInspection: boolean
  related: XpandLeaseDocument[]
  alreadyAttached: XpandLeaseDocument[]
}

const UNSAFE = /[\\/:*?"<>|]/g

export const uploadFilename = (document: XpandLeaseDocument): string => {
  const raw = (document.filename ?? '').trim() || document.title.trim()
  const cleaned = raw
    .replace(UNSAFE, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .replace(/^[._ ]+|[._ ]+$/g, '')
  const name = cleaned || document.keydorev
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`
}

/**
 * Works out what to send where for one lease.
 *
 * The contract goes to upload-file and everything else to related-docs. A
 * contract that loses the tie-break is not thrown away — it is attached as a
 * related document, since related-docs is additive and reversible.
 */
export const planLease = (
  lease: TenfastLeaseSummary,
  documents: XpandLeaseDocument[],
  traits?: Map<string, PdfTraits>
): LeasePlan => {
  const candidates = documents.filter(
    (document) => classifyDocument(document.title) === 'kontrakt'
  )

  let contract: XpandLeaseDocument | null = null
  let contractSkippedReason: string | null = null
  let needsInspection = false

  if (!documents.length) {
    contractSkippedReason = 'no documents in xpand'
  } else if (lease.hasMainFile) {
    contractSkippedReason = 'lease already has a main file'
  } else if (!candidates.length) {
    contractSkippedReason = 'no contract document found'
  } else if (candidates.length === 1) {
    contract = candidates[0]
  } else if (traits) {
    contract =
      pickContract(
        candidates.map((document) => ({
          ...document,
          signed: traits.get(document.keydorev)?.signed ?? false,
          isScan: traits.get(document.keydorev)?.isScan ?? false,
        }))
      ) ?? null
    // map back to the plain document so callers compare identity on keydorev
    contract =
      candidates.find((document) => document.keydorev === contract?.keydorev) ??
      null
  } else {
    needsInspection = true
  }

  // A lease can hold several documents with the same filename; each needs its
  // own name in Tenfast, or the extras become indistinguishable and a resumed
  // run would treat the first upload as covering all of them.
  const filenames = new Map<string, string>()
  const usedNames = new Set<string>()
  for (const document of documents) {
    const base = uploadFilename(document)
    let name = base
    if (usedNames.has(name.toLowerCase())) {
      const extension = path.extname(base)
      name = `${base.slice(0, base.length - extension.length)}-${document.keydorev}${extension}`
    }
    usedNames.add(name.toLowerCase())
    filenames.set(document.keydorev, name)
  }

  // The main file counts as attached: on a rerun the contract is no longer
  // chosen for upload-file, and without this it would land in related-docs.
  const attachedNames = new Set(
    [...lease.relatedNames, lease.mainFileName]
      .filter(Boolean)
      .map((name) => name.toLowerCase())
  )
  // Anything uploaded before the filename encoding was fixed is stored with
  // utf-8 read as latin-1, so match that spelling too rather than re-uploading.
  const asStoredByTenfast = (name: string) =>
    Buffer.from(name, 'utf8').toString('latin1').toLowerCase()
  const isAttached = (name: string) =>
    attachedNames.has(name.toLowerCase()) ||
    attachedNames.has(asStoredByTenfast(name))
  const forRelated = documents.filter(
    (document) => document.keydorev !== contract?.keydorev
  )

  return {
    lease,
    contract,
    contractSkippedReason,
    contractCandidates: candidates,
    needsInspection,
    filenames,
    related: forRelated.filter(
      (document) =>
        !isAttached(
          filenames.get(document.keydorev) ?? uploadFilename(document)
        )
    ),
    alreadyAttached: forRelated.filter((document) =>
      isAttached(filenames.get(document.keydorev) ?? uploadFilename(document))
    ),
  }
}
