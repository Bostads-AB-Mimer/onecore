import {
  classifyDocument,
  inspectPdf,
  isOperativeUppsagning,
  isKontraktBilaga,
  isUppsagningsbekraftelse,
  pickContract,
  type ContractCandidate,
} from './classification'

describe('classifyDocument', () => {
  it.each([
    'Hyreskontrakt för digital signering',
    'Hyreskontrakt för digital signering Bilplats',
    'BILPLATS-02-DIGITAL Hyreskontrakt för digital signering Bilplats',
    'Student hyreskontrakt för digital signering',
    'Kontrakt 209-702-00-0028',
    'KOntrakt 507-001-01-0204',
    'Garagekontrakt Mimer',
    'Korttidskontrakt för digital signering',
    'Hyreskontrakt bil plats',
  ])('treats "%s" as a contract', (title) => {
    expect(classifyDocument(title)).toBe('kontrakt')
  })

  it.each([
    'Hyreskontrakt för digital signering, Bilaga A',
    'BOSTAD-02:A-DIGITAL Hyreskontrakt för digital signering, Bilaga A',
    'Student hyreskontrakt med tilläggsbilaga',
  ])('treats "%s" as an appendix, not a contract', (title) => {
    expect(classifyDocument(title)).toBe('bilaga')
  })

  it.each([
    'Uppsägning av bostad',
    'Uppsägning av bilkontrakt',
    'BOSTAD-03-DIGITAL Bekräftelse på uppsägning av bostad',
  ])('treats "%s" as a termination', (title) => {
    expect(classifyDocument(title)).toBe('uppsagning')
  })

  it.each([
    // these all contain "kontrakt" or "avtal" but are not lease contracts
    'Anställningsavtal',
    'Köpeavtal',
    'Samverkansavtal',
    'Avtalsförslag',
    'Beställning kontrakt inflytt Livet',
    'Godkänt transportavtal',
    'Nekad bytesansökan',
    // and these have nothing to do with contracts
    'Nyckelkvittens',
    'Fullmakt för att hämta ut nycklar',
    'SKM_C454e19020610453',
  ])('does not treat "%s" as a contract', (title) => {
    expect(classifyDocument(title)).toBe('ovrigt')
  })

  it('handles an empty or missing title', () => {
    expect(classifyDocument('')).toBe('ovrigt')
    expect(classifyDocument(null)).toBe('ovrigt')
  })
})

describe('isOperativeUppsagning', () => {
  it.each([
    'Uppsägning av bostad',
    'Uppsägning av bilplats',
    'BILPLATS-04-DIGITAL Uppsägning av bilplats',
    'BOSTAD-05-DIGITAL Uppsägning av bostad',
    'Uppsägning',
    'inkommen uppsägning',
    'Uppsägning dödsbo',
  ])('treats "%s" as an actual uppsägning', (title) => {
    expect(isOperativeUppsagning(title)).toBe(true)
  })

  it.each([
    // Mimer's outgoing letters about a termination, not the termination itself
    'BOSTAD-03-DIGITAL Bekräftelse på uppsägning av bostad',
    'BILPLATS-03-DIGITAL Bekräftelse på uppsägning av bilplats',
    'UPPSÄGNING-02-DIGITAL Ändring av uppsägningstid',
    'BOSTAD-08-DIGITAL Återtagen uppsägning',
  ])('does not treat "%s" as the termination document', (title) => {
    expect(isOperativeUppsagning(title)).toBe(false)
  })

  it('is false for documents that are not uppsägningar at all', () => {
    expect(isOperativeUppsagning('Hyreskontrakt')).toBe(false)
    expect(isOperativeUppsagning('Nyckelkvittens')).toBe(false)
    expect(isOperativeUppsagning('')).toBe(false)
  })
})

describe('isKontraktBilaga', () => {
  it.each([
    // Scrive bundles: page 1 is the full contract, the bilaga follows —
    // xpand just titles the document after the bilaga.
    'Hyreskontrakt för digital signering, Bilaga A',
    'Hyreskontrakt för digital signering, Bilaga K',
    'BOSTAD-02:A-DIGITAL Hyreskontrakt för digital signering, Bilaga A',
    'BOSTAD-02:S-DIGITAL Hyreskontrakt för digital signering, Bilaga S (IMD',
    'Student hyreskontrakt med tilläggsbilaga',
  ])('treats "%s" as a contract bundle', (title) => {
    expect(isKontraktBilaga(title)).toBe(true)
  })

  it.each([
    // a bilaga without a contract word is just an appendix
    'Bilaga A',
    'Besiktningsprotokoll, Bilaga',
    // not bilaga-classified at all
    'Hyreskontrakt för digital signering',
    'Nyckelkvittens',
    // contract word present but not a lease contract
    'Köpekontrakt, Bilaga A',
    '',
  ])('does not treat "%s" as a contract bundle', (title) => {
    expect(isKontraktBilaga(title)).toBe(false)
  })
})

describe('isUppsagningsbekraftelse', () => {
  it.each([
    'BOSTAD-03-DIGITAL Bekräftelse på uppsägning av bostad',
    'BILPLATS-03-DIGITAL Bekräftelse på uppsägning av bilplats',
    'LOKAL-03-DIGITAL Bekräftelse på uppsägning av förråd',
    'DÖDSBO-03-DIGITAL Bekräftelse på uppsägning av dödsbo',
  ])('treats "%s" as a bekräftelse', (title) => {
    expect(isUppsagningsbekraftelse(title)).toBe(true)
  })

  it.each([
    'Uppsägning av bostad',
    'UPPSÄGNING-02-DIGITAL Ändring av uppsägningstid',
    'BOSTAD-08-DIGITAL Återtagen uppsägning',
    'Hyreskontrakt',
    '',
  ])('does not treat "%s" as a bekräftelse', (title) => {
    expect(isUppsagningsbekraftelse(title)).toBe(false)
  })
})

describe('inspectPdf', () => {
  const pdf = (body: string) =>
    Buffer.from(`%PDF-1.4\n${body}\n%%EOF`, 'latin1')

  it('detects a digital signature', () => {
    expect(
      inspectPdf(pdf('/ByteRange [0 100 200 300] /Type /Font')).signed
    ).toBe(true)
    expect(inspectPdf(pdf('/adbe.pkcs7.detached')).signed).toBe(true)
  })

  it('detects a scan: images and no embedded fonts', () => {
    const scan = inspectPdf(pdf('/Filter /DCTDecode /Filter /DCTDecode'))
    expect(scan.isScan).toBe(true)
  })

  it('does not call a text pdf a scan, even when it embeds an image', () => {
    const text = inspectPdf(pdf('/Type /Font /Filter /DCTDecode'))
    expect(text.isScan).toBe(false)
  })

  it('reports an unsigned text document as neither', () => {
    const plain = inspectPdf(pdf('/Type /Font'))
    expect(plain).toEqual({ signed: false, isScan: false })
  })
})

describe('pickContract', () => {
  const candidate = (
    keydorev: string,
    createdAt: string,
    extra: Partial<ContractCandidate> = {}
  ): ContractCandidate => ({
    keydorev,
    createdAt: new Date(createdAt),
    signed: false,
    isScan: false,
    ...extra,
  })

  it('returns null when there are no candidates', () => {
    expect(pickContract([])).toBeNull()
  })

  it('returns the only candidate', () => {
    const only = candidate('a', '2025-01-01')
    expect(pickContract([only])).toBe(only)
  })

  it('prefers a digitally signed contract over a newer unsigned one', () => {
    const signed = candidate('signed', '2024-01-01', { signed: true })
    const newer = candidate('newer', '2025-01-01')
    expect(pickContract([newer, signed])).toBe(signed)
  })

  it('prefers the newest among several signed contracts', () => {
    const older = candidate('older', '2024-01-01', { signed: true })
    const newest = candidate('newest', '2025-01-01', { signed: true })
    expect(pickContract([older, newest])).toBe(newest)
  })

  it('prefers a scanned contract when nothing is digitally signed', () => {
    const scan = candidate('scan', '2024-01-01', { isScan: true })
    const newerPrintout = candidate('printout', '2025-01-01')
    expect(pickContract([newerPrintout, scan])).toBe(scan)
  })

  it('prefers a digital signature over a newer scan', () => {
    const signed = candidate('signed', '2024-01-01', { signed: true })
    const scan = candidate('scan', '2025-01-01', { isScan: true })
    expect(pickContract([scan, signed])).toBe(signed)
  })

  it('falls back to the newest when nothing is signed or scanned', () => {
    const older = candidate('older', '2024-01-01')
    const newest = candidate('newest', '2025-01-01')
    expect(pickContract([older, newest])).toBe(newest)
  })

  it('treats a missing date as oldest rather than throwing', () => {
    const dated = candidate('dated', '2024-01-01')
    const undated = { ...candidate('undated', '2024-01-01'), createdAt: null }
    expect(pickContract([undated, dated])).toBe(dated)
  })
})
