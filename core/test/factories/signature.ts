import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Signature = keys.Signature

export const SignatureFactory = Factory.define<Signature>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  resourceType: 'receipt',
  resourceId: '00000000-0000-0000-0000-000000000001',
  simpleSignDocumentId: 1000 + sequence,
  recipientEmail: `test${sequence}@example.com`,
  status: 'pending',
  sentAt: new Date(),
}))
