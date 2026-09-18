import { collapseInvoiceRecipients } from '@src/scripts/import-contact-relations/collapse'
import { InvoiceRecipientCandidate } from '@src/adapters/xpand/relation-import-query'

const candidate = (
  holderContactCode: string,
  recipientContactCode: string,
  leaseKey: string,
  leaseId = leaseKey
): InvoiceRecipientCandidate => ({
  holderContactCode,
  recipientContactCode,
  leaseKey,
  leaseId,
})

describe('collapseInvoiceRecipients', () => {
  it('returns no edges and no conflicts for empty input', () => {
    expect(collapseInvoiceRecipients([])).toEqual({ edges: [], conflicts: [] })
  })

  it('collapses the same recipient on several leases into one edge', () => {
    const result = collapseInvoiceRecipients([
      candidate('P1', 'P9', 'K1'),
      candidate('P1', 'P9', 'K2'),
    ])

    expect(result.edges).toEqual([
      {
        subjectContactCode: 'P1',
        relatedContactCode: 'P9',
        roleType: 'annan_fakturamottagare',
      },
    ])
    expect(result.conflicts).toEqual([])
  })

  it('reports a holder with two different recipients as a conflict, with lease ids', () => {
    const result = collapseInvoiceRecipients([
      candidate('P1', 'P9', 'K3', 'L3'),
      candidate('P1', 'P8', 'K1', 'L1'),
      candidate('P1', 'P9', 'K2', 'L2'),
    ])

    expect(result.edges).toEqual([])
    expect(result.conflicts).toEqual([
      {
        holderContactCode: 'P1',
        recipients: [
          { contactCode: 'P8', leaseIds: ['L1'] },
          { contactCode: 'P9', leaseIds: ['L2', 'L3'] },
        ],
      },
    ])
  })

  it('dedupes identical candidate rows so a lease appears once', () => {
    const result = collapseInvoiceRecipients([
      candidate('P1', 'P8', 'K1', 'L1'),
      candidate('P1', 'P8', 'K1', 'L1'),
      candidate('P1', 'P9', 'K2', 'L2'),
    ])

    expect(result.conflicts).toEqual([
      {
        holderContactCode: 'P1',
        recipients: [
          { contactCode: 'P8', leaseIds: ['L1'] },
          { contactCode: 'P9', leaseIds: ['L2'] },
        ],
      },
    ])
  })

  it('keeps two leases apart when they share a display label', () => {
    const result = collapseInvoiceRecipients([
      candidate('P1', 'P8', 'K1', 'L1'),
      candidate('P1', 'P8', 'K2', 'L1'),
    ])

    expect(result.edges).toEqual([
      {
        subjectContactCode: 'P1',
        relatedContactCode: 'P8',
        roleType: 'annan_fakturamottagare',
      },
    ])
  })

  it('handles independent holders and sorts output by holder code', () => {
    const result = collapseInvoiceRecipients([
      candidate('P2', 'P9', 'K2'),
      candidate('P1', 'P8', 'K1'),
      candidate('P3', 'P7', 'K3'),
      candidate('P3', 'P6', 'K4'),
    ])

    expect(result.edges.map((e) => e.subjectContactCode)).toEqual(['P1', 'P2'])
    expect(result.conflicts.map((c) => c.holderContactCode)).toEqual(['P3'])
  })

  it('sorts by code unit, independent of the runtime locale', () => {
    const result = collapseInvoiceRecipients([
      candidate('Ö1', 'P9', 'K1'),
      candidate('P1', 'P8', 'K2'),
    ])

    expect(result.edges.map((e) => e.subjectContactCode)).toEqual(['P1', 'Ö1'])
  })
})
