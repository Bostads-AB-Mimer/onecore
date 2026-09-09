/**
 * Classifies xpand lease documents by title for real-time lease sync.
 * Logic aligned with sync-lease-documents (AVTAL-112) — that PR carries the
 * full test suite once merged.
 *
 * Nothing in xpand marks a document as the signed contract: the type is the
 * same for contracts, appendices and terminations, the DOKOP subtype/labeling
 * columns are empty, and SORTORDER is 0 almost everywhere. The document's name
 * is the only classifier available, and the PDF itself is the only evidence of
 * how it was signed.
 */

export type DocumentCategory = 'kontrakt' | 'bilaga' | 'uppsagning' | 'ovrigt'

const NOT_A_LEASE_CONTRACT = [
  'bilaga',
  'uppsägning',
  'uppsagning',
  'beställning',
  'bestallning',
  'förslag',
  'forslag',
  'anställning',
  'anstallning',
  'köpe',
  'kope',
  'samverkan',
  'transport',
  'nekad',
  'nekat',
]

export const classifyDocument = (
  title: string | null | undefined
): DocumentCategory => {
  const name = (title ?? '').toLowerCase()
  if (!name.trim()) return 'ovrigt'

  if (name.includes('bilaga')) return 'bilaga'
  if (name.includes('uppsägning') || name.includes('uppsagning')) {
    return 'uppsagning'
  }
  if (NOT_A_LEASE_CONTRACT.some((word) => name.includes(word))) return 'ovrigt'
  if (name.includes('kontrakt') || name.includes('hyresavtal'))
    return 'kontrakt'

  return 'ovrigt'
}

export const isKontraktBilaga = (title: string | null | undefined): boolean => {
  if (classifyDocument(title) !== 'bilaga') return false
  const name = (title ?? '').toLowerCase()
  if (!name.includes('kontrakt') && !name.includes('hyresavtal')) return false
  return !NOT_A_LEASE_CONTRACT.some(
    (word) => word !== 'bilaga' && name.includes(word)
  )
}

export const isObjektnummerTitle = (
  title: string | null | undefined,
  externalId: string
): boolean => {
  const name = (title ?? '').trim()
  if (!name) return false
  const objektnummer = externalId.split('/')[0]
  return name === objektnummer || name === objektnummer.replace(/-/g, ' ')
}

const NOT_THE_TERMINATION = [
  'bekräftelse',
  'bekraftelse',
  'ändring',
  'andring',
  'återtagen',
  'atertagen',
]

export const isOperativeUppsagning = (
  title: string | null | undefined
): boolean =>
  classifyDocument(title) === 'uppsagning' &&
  !NOT_THE_TERMINATION.some((word) =>
    (title ?? '').toLowerCase().includes(word)
  )

export const isUppsagningsbekraftelse = (
  title: string | null | undefined
): boolean =>
  classifyDocument(title) === 'uppsagning' &&
  ['bekräftelse', 'bekraftelse'].some((word) =>
    (title ?? '').toLowerCase().includes(word)
  )

export const inspectPdf = (content: Buffer): { signed: boolean; isScan: boolean } => {
  const raw = content.toString('latin1')
  const fonts = (raw.match(/\/Type\s*\/Font/g) ?? []).length
  const images = (raw.match(/DCTDecode|JPXDecode|CCITTFaxDecode/g) ?? []).length

  return {
    signed: raw.includes('/ByteRange') || raw.includes('adbe.pkcs7'),
    isScan: fonts === 0 && images >= 1,
  }
}

export type ContractCandidate = {
  keydorev: string
  createdAt: Date | null
  signed: boolean
  isScan: boolean
}

const newest = <T extends ContractCandidate>(candidates: T[]): T =>
  candidates.reduce((best, candidate) =>
    (candidate.createdAt?.getTime() ?? 0) > (best.createdAt?.getTime() ?? 0)
      ? candidate
      : best
  )

export const pickContract = <T extends ContractCandidate>(
  candidates: T[]
): T | null => {
  if (!candidates.length) return null

  const signed = candidates.filter((candidate) => candidate.signed)
  if (signed.length) return newest(signed)

  const scanned = candidates.filter((candidate) => candidate.isScan)
  if (scanned.length) return newest(scanned)

  return newest(candidates)
}

export type LeaseDocumentMeta = {
  keydorev: string
  title: string
  filename: string | null
  createdAt: Date | null
}

const newestDocument = (
  documents: LeaseDocumentMeta[]
): LeaseDocumentMeta | null =>
  documents.length
    ? documents.reduce((best, document) =>
        (document.createdAt?.getTime() ?? 0) > (best.createdAt?.getTime() ?? 0)
          ? document
          : best
      )
    : null

/**
 * Picks the document that should become the lease's main contract in Tenfast.
 * Mirrors sync-lease-documents/plan.ts.
 */
export const pickContractDocument = (
  leaseId: string,
  documents: LeaseDocumentMeta[],
  contentByKeydorev: Map<string, Buffer>
): LeaseDocumentMeta | null => {
  const actualContracts = documents.filter(
    (document) => classifyDocument(document.title) === 'kontrakt'
  )
  const bundleDocs = documents.filter((document) =>
    isKontraktBilaga(document.title)
  )
  const scanCandidates =
    !actualContracts.length && !bundleDocs.length
      ? documents.filter((document) =>
          isObjektnummerTitle(document.title, leaseId)
        )
      : []
  const candidates = actualContracts.length
    ? actualContracts
    : bundleDocs.length
      ? bundleDocs
      : scanCandidates

  if (!candidates.length) return null

  if (scanCandidates.length) {
    const qualified = candidates
      .map((document) => {
        const content = contentByKeydorev.get(document.keydorev)
        const traits = content ? inspectPdf(content) : { signed: false, isScan: false }
        return { ...document, ...traits }
      })
      .filter((candidate) => candidate.signed || candidate.isScan)
    const picked = pickContract(qualified)
    return (
      candidates.find((document) => document.keydorev === picked?.keydorev) ??
      null
    )
  }

  if (candidates.length === 1) return candidates[0]

  const withTraits = candidates.map((document) => {
    const content = contentByKeydorev.get(document.keydorev)
    const traits = content ? inspectPdf(content) : { signed: false, isScan: false }
    return { ...document, ...traits }
  })
  const picked = pickContract(withTraits)
  return (
    candidates.find((document) => document.keydorev === picked?.keydorev) ?? null
  )
}

/**
 * Picks the operative uppsägning for Tenfast's termination file slot.
 */
export const pickTerminationDocument = (
  documents: LeaseDocumentMeta[]
): LeaseDocumentMeta | null => {
  const actualUppsagningar = documents.filter((document) =>
    isOperativeUppsagning(document.title)
  )
  const candidates = actualUppsagningar.length
    ? actualUppsagningar
    : documents.filter((document) => isUppsagningsbekraftelse(document.title))

  return newestDocument(candidates)
}
