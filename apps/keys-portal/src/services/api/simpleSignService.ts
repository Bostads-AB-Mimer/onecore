import type { components } from './core/generated/api-types'
import type { Contact } from '../types'
import { POST, GET } from './core/base-api'

export type Signature = components['schemas']['Signature']
export type SendSignatureRequest = components['schemas']['SendSignatureRequest']

export const simpleSignService = {
  /**
   * Send a PDF document for digital signature via SimpleSign
   */
  async sendForSignature(params: {
    recipient: Contact
    resourceType: 'receipt'
    resourceId: string
    pdfBase64: string
  }): Promise<Signature> {
    const { recipient, resourceType, resourceId, pdfBase64 } = params

    // Extract name from contact, preferring firstName/lastName combination
    const recipientName =
      recipient.firstName && recipient.lastName
        ? `${recipient.firstName} ${recipient.lastName}`
        : recipient.fullName || 'Mottagare'

    // Extract email from contact
    const recipientEmail = recipient.emailAddress

    if (!recipientEmail) {
      throw new Error('Recipient must have an email address')
    }

    const payload: SendSignatureRequest = {
      resourceType,
      resourceId,
      contactId: recipient.contactCode || null, // Save contactCode as contactId
      recipientEmail,
      recipientName,
      personalNumber: recipient.nationalRegistrationNumber || undefined, // For BankID
      pdfBase64,
    }

    const { data, error } = await POST('/signatures/send', { body: payload })
    if (error) throw error
    return data?.content as Signature
  },

  /**
   * Get a signature by ID
   */
  async getById(signatureId: string): Promise<Signature> {
    const { data, error } = await GET('/signatures/{id}', {
      params: { path: { id: signatureId } },
    })
    if (error) throw error
    return data?.content as Signature
  },

  /**
   * Get all signatures for a resource (e.g., receipt)
   */
  async getByResource(
    resourceType: 'receipt',
    resourceId: string
  ): Promise<Signature[]> {
    const { data, error } = await GET(
      '/signatures/resource/{resourceType}/{resourceId}',
      {
        params: { path: { resourceType, resourceId } },
      }
    )
    if (error) {
      if ((error as any)?.status === 404) return []
      throw error
    }
    return (data?.content ?? []) as Signature[]
  },

  /**
   * Helper: Get the latest signature for a resource
   */
  async getLatestForResource(
    resourceType: 'receipt',
    resourceId: string
  ): Promise<Signature | undefined> {
    const signatures = await this.getByResource(resourceType, resourceId)
    if (signatures.length === 0) return undefined

    // Sort by sentAt descending and return the most recent
    return signatures.sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    )[0]
  },

  /**
   * Manually sync signature status from SimpleSign
   */
  async syncSignature(signatureId: string): Promise<Signature> {
    const { data, error } = await POST('/signatures/{id}/sync', {
      params: { path: { id: signatureId } },
    })
    if (error) throw error
    return data?.content as Signature
  },
}
