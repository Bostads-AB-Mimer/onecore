import { Contact } from '@onecore/types'

import transformFromXPandDb from '../../helpers/transformFromXPandDb'

const baseRow = {
  leaseId: '123-456-78/1',
  leaseType: 'Bostadskontrakt',
  fromDate: new Date('2020-01-01'),
  toDate: undefined,
  lastDebitDate: undefined,
  noticeGivenBy: undefined,
  noticeDate: undefined,
  noticeTimeTenant: undefined,
  preferredMoveOutDate: undefined,
  terminationDate: undefined,
  contractDate: undefined,
  approvalDate: undefined,
  totalYearRent: undefined,
}

describe('transformFromXPandDb.toLease', () => {
  it('sets otherInvoiceRecipients from the argument', () => {
    const recipient = { contactCode: 'P004531' } as Contact

    const lease = transformFromXPandDb.toLease(baseRow, [], [], [recipient])

    expect(lease.otherInvoiceRecipients).toEqual([recipient])
  })

  it('leaves otherInvoiceRecipients undefined when not provided', () => {
    const lease = transformFromXPandDb.toLease(baseRow, [], [])

    expect(lease.otherInvoiceRecipients).toBeUndefined()
  })
})
