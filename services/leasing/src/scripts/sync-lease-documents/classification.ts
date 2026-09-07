/**
 * Deciding which xpand document is the lease contract.
 *
 * Nothing in xpand marks a document as the signed contract: the type is the
 * same for contracts, appendices and terminations, the DOKOP subtype/labeling
 * columns are empty, and SORTORDER is 0 almost everywhere. The document's name
 * is the only classifier available, and the PDF itself is the only evidence of
 * how it was signed.
 */

export type DocumentCategory = 'kontrakt' | 'bilaga' | 'uppsagning' | 'ovrigt'

// Names containing "kontrakt"/"avtal" that are not lease contracts —
// employment contracts, purchase agreements, order forms, proposals.
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

/**
 * A bilaga-titled document that is really a contract bundle: Mimer's Scrive
 * flow signs the contract and its bilaga as one PDF, and xpand titles it after
 * the bilaga ("Hyreskontrakt för digital signering, Bilaga K"). Page 1 is the
 * full contract, so when a lease has no contract-titled document the bundle
 * stands in as the main file.
 */
export const isKontraktBilaga = (title: string | null | undefined): boolean => {
  if (classifyDocument(title) !== 'bilaga') return false
  const name = (title ?? '').toLowerCase()
  if (!name.includes('kontrakt') && !name.includes('hyresavtal')) return false
  return !NOT_A_LEASE_CONTRACT.some(
    (word) => word !== 'bilaga' && name.includes(word)
  )
}

// Uppsägning-classified documents that are about a termination without being
// the termination itself: Mimer's outgoing confirmation letter, a change of
// notice period, a withdrawal. They stay related documents — only an actual
// uppsägning may become the lease's termination file.
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

/**
 * Mimer's "Bekräftelse på uppsägning" — sent through Scrive and signed by the
 * tenant with BankID. In the digital termination flow it is the only document
 * produced, so it stands in as the termination file when no actual uppsägning
 * exists. Ändring/återtagen letters never qualify.
 */
export const isUppsagningsbekraftelse = (
  title: string | null | undefined
): boolean =>
  classifyDocument(title) === 'uppsagning' &&
  ['bekräftelse', 'bekraftelse'].some((word) =>
    (title ?? '').toLowerCase().includes(word)
  )

type PdfTraits = {
  signed: boolean
  isScan: boolean
}

/**
 * Reads how a contract was signed straight out of the PDF.
 *
 * A Scrive/BankID-signed document carries a signature dictionary. A contract
 * signed on paper and scanned back in has no embedded fonts at all — it is
 * images of pages. Everything else is an unsigned template or printout.
 */
export const inspectPdf = (content: Buffer): PdfTraits => {
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

/**
 * Picks the document that should become the lease's main contract in Tenfast.
 *
 * A digitally signed document beats everything; a scan of a signed paper
 * contract comes next; otherwise the newest, on the reasoning that a document
 * filed later was filed deliberately.
 */
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
