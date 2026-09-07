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
  relatedFiles: [],
  hasTerminationFile: false,
  terminationFileName: '',
  ...overrides,
})

const stored = (originalName: string) => ({
  key: `avtal-related-docs/6a96834173bef530f24f55fe/6a96928e73bef530f27cb500/${originalName}`,
  originalName,
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

    const plan = planLease(
      lease({ relatedFiles: [stored('Nyckelkvittens.pdf')] }),
      [already, fresh]
    )

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
      lease({ relatedFiles: [stored('UppsÃ¤gning av bostad.pdf')] }),
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

    const plan = planLease(
      lease({ relatedFiles: [stored('Nyckelkvittens.pdf')] }),
      [first, second]
    )

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
        relatedFiles: [stored('Nyckelkvittens.pdf')],
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

describe('planLease — contract bundle fallback', () => {
  const bundle = (
    keydorev: string,
    letter: string,
    overrides: Partial<XpandLeaseDocument> = {}
  ) =>
    doc(keydorev, `Hyreskontrakt för digital signering, Bilaga ${letter}`, {
      filename: `Hyreskontrakt för digital signering, Bilaga ${letter}.pdf`,
      ...overrides,
    })

  it('falls back to a hyreskontrakt-titled bilaga bundle when no contract doc exists', () => {
    // The Scrive flow bundles the signed contract with its bilaga in one PDF,
    // titled after the bilaga — for 7k+ leases it is the only contract there is.
    const bundled = bundle('b1', 'K')
    const receipt = doc('r', 'Nyckelkvittens')

    const plan = planLease(lease(), [bundled, receipt])

    expect(plan.contract?.keydorev).toBe('b1')
    expect(plan.contractSkippedReason).toBeNull()
    expect(plan.related.map((d) => d.keydorev)).toEqual(['r'])
  })

  it('never lets a bundle beat an actual contract document', () => {
    const contract = doc('c', 'Hyreskontrakt för digital signering')
    const bundled = bundle('b1', 'A')

    const plan = planLease(lease(), [contract, bundled])

    expect(plan.contract?.keydorev).toBe('c')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['b1'])
  })

  it('sends competing bundles through pdf inspection like contested contracts', () => {
    const first = bundle('b1', 'A')
    const second = bundle('b2', 'B')

    const plan = planLease(lease(), [first, second])

    expect(plan.needsInspection).toBe(true)
    expect(plan.contractCandidates.map((d) => d.keydorev)).toEqual(['b1', 'b2'])
  })

  it('picks the signed bundle when traits are known', () => {
    const unsigned = bundle('b1', 'A', { createdAt: new Date('2026-03-12') })
    const signed = bundle('b2', 'B', { createdAt: new Date('2026-03-01') })

    const plan = planLease(
      lease(),
      [unsigned, signed],
      new Map([
        ['b1', { signed: false, isScan: false }],
        ['b2', { signed: true, isScan: false }],
      ])
    )

    expect(plan.contract?.keydorev).toBe('b2')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['b1'])
  })

  it('plain bilagor without a contract word never become the main file', () => {
    const appendix = doc('a', 'Bilaga A')
    const plan = planLease(lease(), [appendix])
    expect(plan.contract).toBeNull()
    expect(plan.contractSkippedReason).toBe('no contract document found')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['a'])
  })
})

describe('planLease — main-file copies in related-docs', () => {
  it('uploads the contract even when an earlier run put it in related-docs, and marks the copy for deletion', () => {
    const contract = doc('c', 'Hyreskontrakt för digital signering, Bilaga K', {
      filename: 'Hyreskontrakt för digital signering, Bilaga K.pdf',
    })

    const plan = planLease(
      lease({
        relatedFiles: [
          stored('Hyreskontrakt för digital signering, Bilaga K.pdf'),
        ],
      }),
      [contract]
    )

    expect(plan.contract?.keydorev).toBe('c')
    expect(plan.contractCopiesInRelated.map((f) => f.originalName)).toEqual([
      'Hyreskontrakt för digital signering, Bilaga K.pdf',
    ])
    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached).toEqual([])
  })

  it('still marks the copy for deletion when the upload happened on an earlier run', () => {
    // Crash between upload-file and the related-docs deletion: the main file
    // is set and the resume log proves it is ours, so cleanup must finish.
    const contract = doc('c', 'Hyreskontrakt', {
      filename: 'Hyreskontrakt.pdf',
    })

    const plan = planLease(
      lease({
        hasMainFile: true,
        mainFileName: 'Hyreskontrakt.pdf',
        relatedFiles: [stored('Hyreskontrakt.pdf')],
      }),
      [contract],
      undefined,
      { mainFileUploadedByUs: true }
    )

    expect(plan.contract).toBeNull()
    expect(plan.contractCopiesInRelated.map((f) => f.originalName)).toEqual([
      'Hyreskontrakt.pdf',
    ])
  })

  it('matches a mangled latin-1 related copy of the main file', () => {
    const contract = doc('c', 'Hyreskontrakt östra', {
      filename: 'Hyreskontrakt östra.pdf',
    })

    const plan = planLease(
      lease({
        hasMainFile: true,
        mainFileName: 'Hyreskontrakt östra.pdf',
        relatedFiles: [stored('Hyreskontrakt Ã¶stra.pdf')],
      }),
      [contract],
      undefined,
      { mainFileUploadedByUs: true }
    )

    expect(plan.contractCopiesInRelated.map((f) => f.originalName)).toEqual([
      'Hyreskontrakt Ã¶stra.pdf',
    ])
  })

  it('never deletes a related copy when the main file is not ours', () => {
    // Tenfast generates its own contracts; a name coincidence must not
    // trigger a deletion.
    const contract = doc('c', 'Hyreskontrakt', {
      filename: 'Hyreskontrakt.pdf',
    })

    const plan = planLease(
      lease({
        hasMainFile: true,
        mainFileName: 'Hyreskontrakt.pdf',
        relatedFiles: [stored('Hyreskontrakt.pdf')],
      }),
      [contract]
    )

    expect(plan.contract).toBeNull()
    expect(plan.contractCopiesInRelated).toEqual([])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['c'])
  })
})

describe('planLease — termination document', () => {
  const uppsagning = (
    keydorev: string,
    createdAt: string,
    overrides: Partial<XpandLeaseDocument> = {}
  ) =>
    doc(keydorev, 'Uppsägning av bostad', {
      filename: `Uppsägning ${keydorev}.pdf`,
      createdAt: new Date(createdAt),
      ...overrides,
    })

  it.each(['terminated', 'archived', 'terminationScheduled', 'preTermination'])(
    'sends the newest uppsägning to upload-termination-file on a %s lease',
    (stage) => {
      const older = uppsagning('u1', '2024-05-01')
      const newer = uppsagning('u2', '2025-02-01')
      const receipt = doc('r', 'Nyckelkvittens')

      const plan = planLease(lease({ stage }), [older, newer, receipt])

      expect(plan.termination?.keydorev).toBe('u2')
      expect(plan.terminationSkippedReason).toBeNull()
      // the superseded uppsägning and the receipt stay related documents
      expect(plan.related.map((d) => d.keydorev)).toEqual(['u1', 'r'])
    }
  )

  it('newest wins even over a digitally signed older uppsägning', () => {
    // A re-termination supersedes the aborted one it replaces; signature
    // presence must not resurrect the old document.
    const signedOlder = uppsagning('u1', '2024-05-01')
    const newer = uppsagning('u2', '2025-02-01')

    const plan = planLease(
      lease({ stage: 'terminated' }),
      [signedOlder, newer],
      new Map([
        ['u1', { signed: true, isScan: false }],
        ['u2', { signed: false, isScan: false }],
      ])
    )

    expect(plan.termination?.keydorev).toBe('u2')
  })

  it('routes every uppsägning to related-docs when the lease is still active', () => {
    // Terminated, then the tenant changed their mind: the lease stays active
    // and the uppsägning is history, not the operative termination.
    const aborted = uppsagning('u1', '2024-05-01')

    const plan = planLease(lease({ stage: 'active' }), [aborted])

    expect(plan.termination).toBeNull()
    expect(plan.terminationSkippedReason).toBe(
      'lease not in a terminated stage'
    )
    expect(plan.related.map((d) => d.keydorev)).toEqual(['u1'])
  })

  it('reports when a terminated lease has no uppsägning document', () => {
    const plan = planLease(lease({ stage: 'terminated' }), [
      doc('r', 'Nyckelkvittens'),
    ])
    expect(plan.termination).toBeNull()
    expect(plan.terminationSkippedReason).toBe('no uppsägning document found')
  })

  it('does not touch a termination file Tenfast set itself', () => {
    // A lease terminated via SimpleSign carries a Tenfast-generated
    // termination document; the xpand uppsägning is then only history.
    const document = uppsagning('u1', '2024-05-01')

    const plan = planLease(
      lease({ stage: 'terminated', hasTerminationFile: true }),
      [document]
    )

    expect(plan.termination).toBeNull()
    expect(plan.terminationSkippedReason).toBe(
      'lease already has a termination file'
    )
    expect(plan.terminationCopiesInRelated).toEqual([])
    // the xpand document is still worth keeping, as a related doc
    expect(plan.related.map((d) => d.keydorev)).toEqual(['u1'])
  })

  it('does not re-attach a termination file it uploaded on an earlier run', () => {
    const document = uppsagning('u1', '2024-05-01')

    const plan = planLease(
      lease({ stage: 'terminated', hasTerminationFile: true }),
      [document],
      undefined,
      { terminationUploadedByUs: true }
    )

    expect(plan.termination).toBeNull()
    expect(plan.terminationSkippedReason).toBe(
      'lease already has a termination file'
    )
    expect(plan.related).toEqual([])
  })

  it('uploads the termination even when an earlier run put it in related-docs, and marks the copy for deletion', () => {
    const document = uppsagning('u1', '2024-05-01', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({
        stage: 'terminated',
        relatedFiles: [stored('Uppsägning av bostad.pdf')],
      }),
      [document]
    )

    expect(plan.termination?.keydorev).toBe('u1')
    expect(plan.terminationCopiesInRelated.map((f) => f.originalName)).toEqual([
      'Uppsägning av bostad.pdf',
    ])
    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached).toEqual([])
  })

  it('finds the related-docs copy even when Tenfast stored it in mangled latin-1', () => {
    const document = uppsagning('u1', '2024-05-01', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({
        stage: 'terminated',
        relatedFiles: [stored('UppsÃ¤gning av bostad.pdf')],
      }),
      [document]
    )

    expect(plan.termination?.keydorev).toBe('u1')
    expect(plan.terminationCopiesInRelated.map((f) => f.originalName)).toEqual([
      'UppsÃ¤gning av bostad.pdf',
    ])
  })

  it('still marks the copy for deletion when the upload happened on an earlier run', () => {
    // Rerun after a crash between upload and delete: the termination file is
    // set and the resume log shows we set it, so cleanup must still happen.
    const document = uppsagning('u1', '2024-05-01', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({
        stage: 'terminated',
        hasTerminationFile: true,
        relatedFiles: [stored('Uppsägning av bostad.pdf')],
      }),
      [document],
      undefined,
      { terminationUploadedByUs: true }
    )

    expect(plan.termination).toBeNull()
    expect(plan.terminationCopiesInRelated.map((f) => f.originalName)).toEqual([
      'Uppsägning av bostad.pdf',
    ])
    expect(plan.related).toEqual([])
  })

  it('does not delete a related copy on a lease whose termination file is not ours', () => {
    const document = uppsagning('u1', '2024-05-01', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({
        stage: 'terminated',
        hasTerminationFile: true,
        relatedFiles: [stored('Uppsägning av bostad.pdf')],
      }),
      [document]
    )

    expect(plan.termination).toBeNull()
    expect(plan.terminationCopiesInRelated).toEqual([])
    // already attached, so it is not re-uploaded either
    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['u1'])
  })

  it('never picks the bekräftelse letter over the actual uppsägning, even when newer', () => {
    const actual = uppsagning('u1', '2024-05-01')
    const confirmation = doc(
      'b1',
      'BOSTAD-03-DIGITAL Bekräftelse på uppsägning av bostad',
      { createdAt: new Date('2024-05-02') }
    )

    const plan = planLease(lease({ stage: 'terminated' }), [
      actual,
      confirmation,
    ])

    expect(plan.termination?.keydorev).toBe('u1')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['b1'])
  })

  it('falls back to the bekräftelse when no actual uppsägning exists', () => {
    // The digital termination flow produces only a tenant-BankID-signed
    // "Bekräftelse på uppsägning" — for those leases it IS the termination.
    const confirmation = doc(
      'b1',
      'BILPLATS-03-DIGITAL Bekräftelse på uppsägning av bilplats'
    )

    const plan = planLease(lease({ stage: 'terminated' }), [confirmation])

    expect(plan.termination?.keydorev).toBe('b1')
    expect(plan.terminationSkippedReason).toBeNull()
    expect(plan.related).toEqual([])
  })

  it('picks the newest bekräftelse when several compete in the fallback', () => {
    const older = doc(
      'b1',
      'BOSTAD-03-DIGITAL Bekräftelse på uppsägning av bostad',
      { createdAt: new Date('2025-01-01') }
    )
    const newer = doc(
      'b2',
      'BOSTAD-03-DIGITAL Bekräftelse på uppsägning av bostad',
      { createdAt: new Date('2026-02-01') }
    )

    const plan = planLease(lease({ stage: 'terminated' }), [older, newer])

    expect(plan.termination?.keydorev).toBe('b2')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['b1'])
  })

  it('never falls back to an ändring or återtagen document', () => {
    const change = doc('a1', 'UPPSÄGNING-02-DIGITAL Ändring av uppsägningstid')
    const withdrawal = doc('a2', 'BOSTAD-08-DIGITAL Återtagen uppsägning')

    const plan = planLease(lease({ stage: 'terminated' }), [change, withdrawal])

    expect(plan.termination).toBeNull()
    expect(plan.terminationSkippedReason).toBe('no uppsägning document found')
    expect(plan.related.map((d) => d.keydorev)).toEqual(['a1', 'a2'])
  })

  it('treats the termination file it set on an earlier run as attached, even without the resume log', () => {
    // A rerun from a clean output directory has no actions.csv. The listing's
    // cancellation.file name is the only thing stopping the uppsägning from
    // falling through into related-docs as a duplicate.
    const document = uppsagning('u1', '2024-05-01', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({
        stage: 'terminated',
        hasTerminationFile: true,
        terminationFileName: 'Uppsägning av bostad.pdf',
      }),
      [document]
    )

    expect(plan.termination).toBeNull()
    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['u1'])
  })

  it('matches a mangled latin-1 termination-file name too', () => {
    const document = uppsagning('u1', '2024-05-01', {
      filename: 'Uppsägning av bostad.pdf',
    })

    const plan = planLease(
      lease({
        stage: 'terminated',
        hasTerminationFile: true,
        terminationFileName: 'UppsÃ¤gning av bostad.pdf',
      }),
      [document]
    )

    expect(plan.related).toEqual([])
    expect(plan.alreadyAttached.map((d) => d.keydorev)).toEqual(['u1'])
  })

  it('does not confuse the uppsägning with the contract', () => {
    const contract = doc('c', 'Hyreskontrakt')
    const termination = uppsagning('u1', '2024-05-01')

    const plan = planLease(lease({ stage: 'terminated' }), [
      contract,
      termination,
    ])

    expect(plan.contract?.keydorev).toBe('c')
    expect(plan.termination?.keydorev).toBe('u1')
    expect(plan.related).toEqual([])
  })
})
