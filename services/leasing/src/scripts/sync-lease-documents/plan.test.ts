import { planLease, uploadFilename } from './plan'
import type { XpandLeaseDocument } from './xpand-documents'
import type { TenfastLeaseSummary } from './tenfast-documents'

const doc = (
  keydorev: string,
  title: string,
  overrides: Partial<XpandLeaseDocument> = {}
): XpandLeaseDocument => ({
  leaseId: '307-714-00-0102/08',
  keydorev,
  dok: `dok-${keydorev}`,
  title,
  filename: `${title}.pdf`,
  documentType: 'Hyreskontrakt',
  createdAt: new Date('2025-01-01'),
  sortorder: 0,
  ...overrides,
})

const lease = (
  overrides: Partial<TenfastLeaseSummary> = {}
): TenfastLeaseSummary => ({
  id: 'tenfast-id',
  externalId: '307-714-00-0102/08',
  stage: 'active',
  hasMainFile: false,
  mainFileName: '',
  relatedNames: [],
  ...overrides,
})

describe('uploadFilename', () => {
  it('uses the xpand filename', () => {
    expect(uploadFilename(doc('a', 'Hyreskontrakt'))).toBe('Hyreskontrakt.pdf')
  })

  it('falls back to the title when there is no filename', () => {
    expect(uploadFilename(doc('a', 'Hyreskontrakt', { filename: null }))).toBe(
      'Hyreskontrakt.pdf'
    )
  })

  it('appends a pdf extension when the name lacks one', () => {
    expect(uploadFilename(doc('a', 'Kontrakt', { filename: 'Kontrakt' }))).toBe(
      'Kontrakt.pdf'
    )
  })

  it('strips path separators', () => {
    expect(
      uploadFilename(doc('a', 'x', { filename: '../../etc/passwd.pdf' }))
    ).toBe('etc_passwd.pdf')
  })

  it('falls back to the keydorev when nothing usable is left', () => {
    expect(
      uploadFilename(doc('_ABC123', 'x', { filename: '  ', title: '  ' }))
    ).toBe('_ABC123.pdf')
  })
})

describe('planLease', () => {
  it('sends the single contract to upload-file and the rest to related-docs', () => {
    const contract = doc('c', 'Hyreskontrakt för digital signering')
    const receipt = doc('r', 'Nyckelkvittens')
    const appendix = doc('b', 'Hyreskontrakt för digital signering, Bilaga A')

    const plan = planLease(lease(), [contract, receipt, appendix])

    expect(plan.contract?.keydorev).toBe('c')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['r', 'b'])
    expect(plan.contractSkippedReason).toBeNull()
  })

  it('never puts the chosen contract in related-docs as well', () => {
    const contract = doc('c', 'Hyreskontrakt')
    const plan = planLease(lease(), [contract])
    expect(plan.related).toEqual([])
  })

  it('leaves the main file alone when the lease already has one', () => {
    const contract = doc('c', 'Hyreskontrakt')
    const other = doc('o', 'Nyckelkvittens')

    const plan = planLease(lease({ hasMainFile: true }), [contract, other])

    expect(plan.contract).toBeNull()
    expect(plan.contractSkippedReason).toBe('lease already has a main file')
    // the contract still gets attached, just not as the main file
    expect(plan.related.map((d) => d.keydorev)).toEqual(['c', 'o'])
  })

  it('skips related documents already attached in Tenfast', () => {
    const already = doc('a', 'Nyckelkvittens')
    const fresh = doc('f', 'Kvittens droppar')

    const plan = planLease(lease({ relatedNames: ['Nyckelkvittens.pdf'] }), [
      already,
      fresh,
    ])

    expect(plan.related.map((d) => d.keydorev)).toEqual(['f'])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['a'])
  })

  it('recognises a name Tenfast stored in the mangled latin-1 form', () => {
    // Documents uploaded before the filename encoding was fixed are stored as
    // "UppsÃ¤gning..."; they must not be uploaded a second time.
    const document = doc('u', 'Uppsägning av bostad', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({ relatedNames: ['UppsÃ¤gning av bostad.pdf'] }),
      [document]
    )

    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['u'])
  })

  it('gives distinct names to documents that share a filename', () => {
    // A lease can hold two different scans both called
    // "Nyckelkvittens 705-023-03-0102.pdf". Uploading both under one name
    // makes the second indistinguishable, and a resumed run would skip it.
    const first = doc('k1', 'Nyckelkvittens', {
      filename: 'Nyckelkvittens.pdf',
    })
    const second = doc('k2', 'Nyckelkvittens', {
      filename: 'Nyckelkvittens.pdf',
    })

    const plan = planLease(lease(), [first, second])

    const names = plan.related.map((d) => plan.filenames.get(d.keydorev))
    expect(names[0]).toBe('Nyckelkvittens.pdf')
    expect(names[1]).toBe('Nyckelkvittens-k2.pdf')
    expect(new Set(names).size).toBe(2)
  })

  it('skips only the duplicate that is already attached', () => {
    const first = doc('k1', 'Nyckelkvittens', {
      filename: 'Nyckelkvittens.pdf',
    })
    const second = doc('k2', 'Nyckelkvittens', {
      filename: 'Nyckelkvittens.pdf',
    })

    const plan = planLease(lease({ relatedNames: ['Nyckelkvittens.pdf'] }), [
      first,
      second,
    ])

    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['k1'])
    expect(plan.related.map((d) => d.keydorev)).toEqual(['k2'])
  })

  it('does not re-attach the contract it already uploaded as the main file', () => {
    // On a second run hasMainFile is true, so the contract is not sent to
    // upload-file again — but it must not fall through into related-docs
    // either, or every rerun adds a duplicate.
    const contract = doc('c', 'Hyreskontrakt', {
      filename: 'Hyreskontrakt.pdf',
    })
    const other = doc('o', 'Nyckelkvittens', { filename: 'Nyckelkvittens.pdf' })

    const plan = planLease(
      lease({
        hasMainFile: true,
        mainFileName: 'Hyreskontrakt.pdf',
        relatedNames: ['Nyckelkvittens.pdf'],
      }),
      [contract, other]
    )

    expect(plan.contract).toBeNull()
    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['c', 'o'])
  })

  it('still attaches other documents when the main file is unrelated', () => {
    const contract = doc('c', 'Hyreskontrakt', {
      filename: 'Hyreskontrakt.pdf',
    })

    const plan = planLease(
      lease({ hasMainFile: true, mainFileName: 'Something else entirely.pdf' }),
      [contract]
    )

    expect(plan.related.map((d) => d.keydorev)).toEqual(['c'])
  })

  it('reports no contract when the lease has none', () => {
    const plan = planLease(lease(), [doc('r', 'Nyckelkvittens')])
    expect(plan.contract).toBeNull()
    expect(plan.contractSkippedReason).toBe('no contract document found')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['r'])
  })

  it('needs inspection when several contracts compete', () => {
    const first = doc('c1', 'Hyreskontrakt för digital signering')
    const second = doc('c2', 'Hyreskontrakt bil plats')

    const plan = planLease(lease(), [first, second])

    expect(plan.needsInspection).toBe(true)
    expect(plan.contractCandidates.map((d) => d.keydorev)).toEqual(['c1', 'c2'])
  })

  it('uses pdf traits to choose between competing contracts', () => {
    const unsignedNewer = doc('new', 'Hyreskontrakt bil plats', {
      createdAt: new Date('2026-03-12'),
    })
    const signedOlder = doc('signed', 'Hyreskontrakt för digital signering', {
      createdAt: new Date('2026-03-01'),
    })

    const plan = planLease(
      lease(),
      [unsignedNewer, signedOlder],
      new Map([
        ['new', { signed: false, isScan: false }],
        ['signed', { signed: true, isScan: false }],
      ])
    )

    expect(plan.contract?.keydorev).toBe('signed')
    // the runner-up is still attached as a related document
    expect(plan.related.map((d) => d.keydorev)).toEqual(['new'])
  })

  it('handles a lease with no documents at all', () => {
    const plan = planLease(lease(), [])
    expect(plan.contract).toBeNull()
    expect(plan.related).toEqual([])
    expect(plan.contractSkippedReason).toBe('no documents in xpand')
  })
})
