import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Signature = keys.v1.Signature

export const SignatureFactory = Factory.define<Signature>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  resourceType: 'key-loan',
  resourceId: '00000000-0000-0000-0000-000000000001',
  recipientEmail: `test${sequence}@example.com`,
  status: 'pending',
  signatureProvider: 'simplesign',
  externalSignatureId: `ext-sig-${sequence}`,
  createdAt: new Date(),
  updatedAt: new Date(),
}))
