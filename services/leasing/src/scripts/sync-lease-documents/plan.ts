import path from 'path'

import {
  classifyDocument,
  isKontraktBilaga,
  isOperativeUppsagning,
  isUppsagningsbekraftelse,
  pickContract,
} from './classification'
import type {
  TenfastLeaseSummary,
  TenfastRelatedFile,
} from './tenfast-documents'
import type { XpandLeaseDocument } from './xpand-documents'

export type PdfTraits = { signed: boolean; isScan: boolean }

export type LeasePlan = {
  lease: TenfastLeaseSummary
  filenames: Map<string, string>
  contract: XpandLeaseDocument | null
  contractSkippedReason: string | null
  contractCandidates: XpandLeaseDocument[]
  contractCopiesInRelated: TenfastRelatedFile[]
  needsInspection: boolean
  termination: XpandLeaseDocument | null
  terminationSkippedReason: string | null
  terminationCandidates: XpandLeaseDocument[]
  terminationCopiesInRelated: TenfastRelatedFile[]
  related: XpandLeaseDocument[]
  alreadyAttached: XpandLeaseDocument[]
}

export type PlanRunState = {
  // actions.csv shows an upload-termination-file row for this lease, i.e. the
  // termination file in Tenfast is ours — not one Tenfast generated itself.
  terminationUploadedByUs?: boolean
  // same, for upload-file: the main contract file in Tenfast is ours.
  mainFileUploadedByUs?: boolean
}

// Stages where a termination is in progress or completed. Anywhere else an
// uppsägning document is history — a termination that was aborted — and only
// worth keeping as a related document.
export const TERMINATION_STAGES = new Set([
  'terminated',
  'archived',
  'terminationScheduled',
  'preTermination',
])

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

const newestOf = (
  candidates: XpandLeaseDocument[]
): XpandLeaseDocument | null =>
  candidates.length
    ? candidates.reduce((best, candidate) =>
        (candidate.createdAt?.getTime() ?? 0) > (best.createdAt?.getTime() ?? 0)
          ? candidate
          : best
      )
    : null

/**
 * Works out what to send where for one lease.
 *
 * The contract goes to upload-file, the operative uppsägning to
 * upload-termination-file, and everything else to related-docs. A document
 * that loses a tie-break is not thrown away — it is attached as a related
 * document, since related-docs is additive and reversible.
 */
export const planLease = (
  lease: TenfastLeaseSummary,
  documents: XpandLeaseDocument[],
  traits?: Map<string, PdfTraits>,
  runState: PlanRunState = {}
): LeasePlan => {
  // A contract-titled document wins; when the lease holds none, a
  // hyreskontrakt-titled bilaga stands in — the Scrive flow bundles the signed
  // contract with its bilaga in one PDF, titled after the bilaga.
  const actualContracts = documents.filter(
    (document) => classifyDocument(document.title) === 'kontrakt'
  )
  const candidates = actualContracts.length
    ? actualContracts
    : documents.filter((document) => isKontraktBilaga(document.title))
  // An actual uppsägning wins; when the lease holds none (the digital flow
  // produces only the tenant-signed bekräftelse) the bekräftelse stands in.
  const actualUppsagningar = documents.filter((document) =>
    isOperativeUppsagning(document.title)
  )
  const terminationCandidates = actualUppsagningar.length
    ? actualUppsagningar
    : documents.filter((document) => isUppsagningsbekraftelse(document.title))

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

  // The operative termination is strictly the newest uppsägning: a
  // re-termination supersedes the one it replaces, signed or not.
  const operativeTermination = TERMINATION_STAGES.has(lease.stage)
    ? newestOf(terminationCandidates)
    : null

  let termination: XpandLeaseDocument | null = null
  let terminationSkippedReason: string | null = null
  if (!documents.length) {
    terminationSkippedReason = 'no documents in xpand'
  } else if (!TERMINATION_STAGES.has(lease.stage)) {
    terminationSkippedReason = 'lease not in a terminated stage'
  } else if (lease.hasTerminationFile) {
    terminationSkippedReason = 'lease already has a termination file'
  } else if (!operativeTermination) {
    terminationSkippedReason = 'no uppsägning document found'
  } else {
    termination = operativeTermination
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
    [
      ...lease.relatedFiles.map((file) => file.originalName),
      lease.mainFileName,
      lease.terminationFileName,
    ]
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

  // The operative termination is ours to place whenever we upload it (or
  // already have): it must not fall through into related-docs, and any copy an
  // earlier run left there is marked for deletion. When Tenfast set the
  // termination file itself the xpand document is only history — it takes the
  // normal related-docs route and nothing is deleted.
  const terminationIsOurs =
    operativeTermination !== null &&
    (termination !== null || runState.terminationUploadedByUs === true)
  const terminationName = operativeTermination
    ? (filenames.get(operativeTermination.keydorev) ??
      uploadFilename(operativeTermination))
    : ''
  const terminationCopiesInRelated = terminationIsOurs
    ? lease.relatedFiles.filter(
        (file) =>
          file.originalName.toLowerCase() === terminationName.toLowerCase() ||
          file.originalName.toLowerCase() === asStoredByTenfast(terminationName)
      )
    : []

  // Same for the main file: a copy an earlier run left in related-docs is
  // deleted once the upload-file slot holds our upload of the same document —
  // never when Tenfast generated the main file itself.
  const mainFileIsOurs =
    contract !== null ||
    (lease.hasMainFile && runState.mainFileUploadedByUs === true)
  const mainFileName = contract
    ? (filenames.get(contract.keydorev) ?? uploadFilename(contract))
    : lease.mainFileName
  const contractCopiesInRelated =
    mainFileIsOurs && mainFileName
      ? lease.relatedFiles.filter(
          (file) =>
            file.originalName.toLowerCase() === mainFileName.toLowerCase() ||
            file.originalName.toLowerCase() === asStoredByTenfast(mainFileName)
        )
      : []

  const forRelated = documents.filter(
    (document) =>
      document.keydorev !== contract?.keydorev &&
      !(
        terminationIsOurs &&
        document.keydorev === operativeTermination?.keydorev
      )
  )

  return {
    lease,
    contract,
    contractSkippedReason,
    contractCandidates: candidates,
    contractCopiesInRelated,
    needsInspection,
    termination,
    terminationSkippedReason,
    terminationCandidates,
    terminationCopiesInRelated,
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
