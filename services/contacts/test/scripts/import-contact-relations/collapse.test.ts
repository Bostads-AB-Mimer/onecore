import { collapseInvoiceRecipients } from '@src/scripts/import-contact-relations/collapse'

describe('collapseInvoiceRecipients', () => {
  it('returns no edges and no conflicts for empty input', () => {
    expect(collapseInvoiceRecipients([])).toEqual({ edges: [], conflicts: [] })
  })

  it('collapses the same recipient on several leases into one edge', () => {
    const result = collapseInvoiceRecipients([
      { holderContactCode: 'P1', recipientContactCode: 'P9', leaseId: 'L1' },
      { holderContactCode: 'P1', recipientContactCode: 'P9', leaseId: 'L2' },
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
      { holderContactCode: 'P1', recipientContactCode: 'P9', leaseId: 'L3' },
      { holderContactCode: 'P1', recipientContactCode: 'P8', leaseId: 'L1' },
      { holderContactCode: 'P1', recipientContactCode: 'P9', leaseId: 'L2' },
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

  it('dedupes identical candidate rows so a lease id appears once', () => {
    const result = collapseInvoiceRecipients([
      { holderContactCode: 'P1', recipientContactCode: 'P8', leaseId: 'L1' },
      { holderContactCode: 'P1', recipientContactCode: 'P8', leaseId: 'L1' },
      { holderContactCode: 'P1', recipientContactCode: 'P9', leaseId: 'L2' },
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

  it('handles independent holders and sorts output by holder code', () => {
    const result = collapseInvoiceRecipients([
      { holderContactCode: 'P2', recipientContactCode: 'P9', leaseId: 'L2' },
      { holderContactCode: 'P1', recipientContactCode: 'P8', leaseId: 'L1' },
      { holderContactCode: 'P3', recipientContactCode: 'P7', leaseId: 'L3' },
      { holderContactCode: 'P3', recipientContactCode: 'P6', leaseId: 'L4' },
    ])

    expect(result.edges.map((e) => e.subjectContactCode)).toEqual(['P1', 'P2'])
    expect(result.conflicts.map((c) => c.holderContactCode)).toEqual(['P3'])
  })
})
