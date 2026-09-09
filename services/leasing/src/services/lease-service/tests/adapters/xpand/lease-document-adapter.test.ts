let dokopRows: Array<Record<string, unknown>> = []
let dofilRows: Array<{ fildata: string | null }> = []

const chainableSelect = (result: unknown) => {
  const builder = {
    join: jest.fn(),
    where: jest.fn(),
    select: jest.fn().mockResolvedValue(result),
  }
  builder.join.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)
  return builder
}

jest.mock('../../../adapters/xpand/xpandDb', () => ({
  xpandDb: jest.fn((table: string) => {
    if (table === 'dofil') {
      return {
        where: jest.fn().mockReturnValue({
          select: jest.fn().mockImplementation(() => Promise.resolve(dofilRows)),
        }),
      }
    }
    return chainableSelect(dokopRows)
  }),
}))

import { getTerminationDocumentPdf } from '../../../adapters/xpand/lease-document-adapter'

const pdfHex = Buffer.from('pdf-bytes').toString('hex')

beforeEach(() => {
  dokopRows = []
  dofilRows = []
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
