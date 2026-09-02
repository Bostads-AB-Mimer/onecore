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
