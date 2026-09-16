let dokopRows: Array<Record<string, unknown>> = []
let dorevRows: Array<Record<string, unknown>> = []
let dofilRows: Array<{ fildata: string | null }> = []
let dofilByKeydorev: Record<string, Array<{ fildata: string | null }>> = {}
let dofilWhere: jest.Mock

const chainableSelect = (result: unknown) => {
  const builder = {
    join: jest.fn(),
    where: jest.fn(),
    andWhereLike: jest.fn(),
    orderBy: jest.fn(),
    select: jest.fn().mockResolvedValue(result),
  }
  builder.join.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)
  builder.andWhereLike.mockReturnValue(builder)
  builder.orderBy.mockReturnValue(builder)
  return builder
}

jest.mock('../../../adapters/xpand/xpandDb', () => ({
  xpandDb: jest.fn((table: string) => {
    if (table === 'dofil') {
      dofilWhere = jest.fn().mockImplementation(
        (criteria: { keydorev: string }) => ({
          select: jest.fn().mockImplementation(() =>
            Promise.resolve(
              dofilByKeydorev[criteria.keydorev] ?? dofilRows
            )
          ),
        })
      )
      return { where: dofilWhere }
    }
    if (table === 'dorev') {
      return chainableSelect(dorevRows)
    }
    return chainableSelect(dokopRows)
  }),
}))

import {
  getSignedContractPdf,
  getTerminationDocumentPdf,
} from '../../../adapters/xpand/lease-document-adapter'

const pdfHex = Buffer.from('pdf-bytes').toString('hex')

beforeEach(() => {
  dokopRows = []
  dorevRows = []
  dofilRows = []
  dofilByKeydorev = {}
})

describe(getTerminationDocumentPdf, () => {
  it('returns the newest operative uppsägning', async () => {
    dokopRows = [
      {
        keydorev: 'old',
        title: 'Uppsägning av bostad',
        filename: 'old.pdf',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        keydorev: 'new',
        title: 'Uppsägning av bostad',
        filename: 'new.pdf',
        createdAt: '2025-06-01T00:00:00.000Z',
      },
    ]
    dofilRows = [{ fildata: pdfHex }]

    const result = await getTerminationDocumentPdf('123-456/01')

    expect(result).toEqual({
      filename: 'new.pdf',
      content: Buffer.from('pdf-bytes'),
    })
  })

  it('reads dofil rows with filtype 1 only', async () => {
    dokopRows = [
      {
        keydorev: 'new',
        title: 'Uppsägning av bostad',
        filename: 'new.pdf',
        createdAt: '2025-06-01T00:00:00.000Z',
      },
    ]
    dofilRows = [{ fildata: pdfHex }]

    await getTerminationDocumentPdf('123-456/01')

    expect(dofilWhere).toHaveBeenCalledWith({ keydorev: 'new', filtype: 1 })
  })

  it('falls back to bekräftelse when no operative uppsägning exists', async () => {
    dokopRows = [
      {
        keydorev: 'bek',
        title: 'Bekräftelse på uppsägning',
        filename: null,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]
    dofilRows = [{ fildata: pdfHex }]

    const result = await getTerminationDocumentPdf('123-456/01')

    expect(result?.filename).toBe('Bekräftelse på uppsägning.pdf')
  })

  it('does not fall back to withdrawn termination confirmation', async () => {
    dokopRows = [
      {
        keydorev: 'withdrawn',
        title: 'Bekräftelse på återtagen uppsägning',
        filename: null,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]
    dofilRows = [{ fildata: pdfHex }]

    const result = await getTerminationDocumentPdf('123-456/01')

    expect(result).toBeNull()
  })

  it('returns null when no uppsägning document is found', async () => {
    dokopRows = [
      {
        keydorev: 'kontrakt',
        title: 'Hyreskontrakt lägenhet',
        filename: 'kontrakt.pdf',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]

    const result = await getTerminationDocumentPdf('123-456/01')

    expect(result).toBeNull()
  })

  it('returns null when the picked document has no decodable file content', async () => {
    dokopRows = [
      {
        keydorev: 'upps',
        title: 'Uppsägning av bostad',
        filename: 'upps.pdf',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]
    dofilRows = [{ fildata: null }]

    const result = await getTerminationDocumentPdf('123-456/01')

    expect(result).toBeNull()
  })
})

describe(getSignedContractPdf, () => {
  it('returns older contract PDF when newer contract row has no file content', async () => {
    dokopRows = [
      {
        keydorev: 'new-empty',
        title: 'Hyreskontrakt för digital signering',
        filename: 'new.pdf',
        createdAt: '2025-06-01T00:00:00.000Z',
      },
      {
        keydorev: 'old-pdf',
        title: 'Hyreskontrakt för digital signering',
        filename: 'old.pdf',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]
    dofilByKeydorev = {
      'new-empty': [{ fildata: null }],
      'old-pdf': [{ fildata: pdfHex }],
    }

    const result = await getSignedContractPdf('123-456/01')

    expect(result).toEqual({
      filename: 'old.pdf',
      content: Buffer.from('pdf-bytes'),
    })
  })

  it('returns a contract-titled document from dokop', async () => {
    dokopRows = [
      {
        keydorev: 'kontrakt',
        title: 'Hyreskontrakt för digital signering',
        filename: 'kontrakt.pdf',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]
    dofilRows = [{ fildata: pdfHex }]

    const result = await getSignedContractPdf('123-456/01')

    expect(result).toEqual({
      filename: 'kontrakt.pdf',
      content: Buffer.from('pdf-bytes'),
    })
  })

  it('falls back to DO_SLUTF dorev rows when dokop finds no contract', async () => {
    dokopRows = []
    dorevRows = [{ keydorev: 'slutf', path: 'signed.pdf' }]
    dofilRows = [{ fildata: pdfHex }]

    const result = await getSignedContractPdf('123-456/01')

    expect(result).toEqual({
      filename: 'signed.pdf',
      content: Buffer.from('pdf-bytes'),
    })
  })
})
