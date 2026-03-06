import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Signature = keys.Signature

/**
 * Factory for generating Signature test data.
 *
 * @example
 * // Default signature
 * const signature = SignatureFactory.build()
 *
 * @example
 * // Signed signature
 * const signedSignature = SignatureFactory.build({
 *   status: 'signed',
 *   completedAt: new Date()
 * })
 */
export const SignatureFactory = Factory.define<Signature>(({ sequence }) => {
  const now = new Date()

  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    resourceType: 'receipt',
    resourceId: `resource-${sequence}`,
    simpleSignDocumentId: sequence,
    recipientEmail: `recipient-${sequence}@example.com`,
    recipientName: `Recipient ${sequence}`,
    status: 'sent',
    sentAt: now,
    completedAt: undefined,
    lastSyncedAt: undefined,
  }
})
