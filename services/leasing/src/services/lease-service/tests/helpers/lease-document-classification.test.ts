import {
  LeaseDocumentMeta,
  pickContractDocument,
} from '../../helpers/lease-document-classification'

const document = (
  keydorev: string,
  title: string,
  createdAt: string
): LeaseDocumentMeta => ({
  keydorev,
  title,
  filename: null,
  createdAt: new Date(createdAt),
})

describe(pickContractDocument, () => {
  const leaseId = '123-456/01'

  it('prefers signed contract over newer unsigned', () => {
    const documents = [
      document('new', 'Hyreskontrakt', '2025-06-01T00:00:00.000Z'),
      document('old', 'Hyreskontrakt', '2024-01-01T00:00:00.000Z'),
    ]
    const contentByKeydorev = new Map([
      ['new', Buffer.from('unsigned')],
      ['old', Buffer.from('%PDF-1.4 /ByteRange')],
    ])

    const picked = pickContractDocument(leaseId, documents, contentByKeydorev)

    expect(picked?.keydorev).toBe('old')
  })

  it('falls back to kontrakt bilaga when no contract-titled documents exist', () => {
    const documents = [
      document('bilaga', 'Bilaga till hyreskontrakt', '2025-01-01T00:00:00.000Z'),
    ]
    const content = Buffer.from('bundle-pdf')
    const contentByKeydorev = new Map([['bilaga', content]])

    const picked = pickContractDocument(leaseId, documents, contentByKeydorev)

    expect(picked?.keydorev).toBe('bilaga')
  })

  it('uses object-number scan title when no contract or bilaga documents exist', () => {
    const documents = [
      document('scan', '123-456', '2025-01-01T00:00:00.000Z'),
    ]
    const contentByKeydorev = new Map([
      ['scan', Buffer.from('DCTDecode scanned image payload')],
    ])

    const picked = pickContractDocument(leaseId, documents, contentByKeydorev)

    expect(picked?.keydorev).toBe('scan')
  })

  it('excludes non-contract titles such as uppsägning', () => {
    const documents = [
      document('upps', 'Uppsägning av bostad', '2025-06-01T00:00:00.000Z'),
    ]
    const contentByKeydorev = new Map([
      ['upps', Buffer.from('%PDF-1.4 /ByteRange')],
    ])

    const picked = pickContractDocument(leaseId, documents, contentByKeydorev)

    expect(picked).toBeNull()
  })
})
