import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Receipt = keys.v1.Receipt

export const ReceiptFactory = Factory.define<Receipt>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  keyLoanId: '00000000-0000-0000-0000-000000000001',
  loanType: 'REGULAR',
  receiptType: 'LOAN',
  type: 'DIGITAL',
  fileId: `file-${sequence}`,
  createdAt: new Date(),
  updatedAt: new Date(),
}))
