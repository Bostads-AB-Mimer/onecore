import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Receipt = keys.Receipt

export const ReceiptFactory = Factory.define<Receipt>(({ sequence }) => {
  const now = new Date()
  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    keyLoanId: `00000000-0000-0000-0000-${String(1000 + sequence).padStart(12, '0')}`,
    loanType: 'REGULAR',
    receiptType: sequence % 2 === 0 ? 'LOAN' : 'RETURN',
    type: 'DIGITAL',
    fileId: undefined,
    createdAt: new Date(now.getTime() - 86400000),
    updatedAt: new Date(now.getTime() - 86400000),
  }
})
