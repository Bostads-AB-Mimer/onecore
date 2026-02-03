import { logger } from '@onecore/utilities'
import Config from '../../../common/config'
import FormData from 'form-data'
import axios from 'axios'

/**
 * SimpleSign API adapter
 * Handles communication with SimpleSign API for digital signatures
 */

interface SendPdfForSignatureParams {
  pdfBase64: string
  recipientEmail: string
  recipientName?: string
}

interface SendPdfForSignatureResponse {
  id: number // SimpleSign document ID
  message: string
}

interface DocumentDetails {
  id: number
  name: string
  status: string
  status_updated_at: string
  recipients: any[]
}

/**
 * Send a PDF document to SimpleSign for signature
 * POST /signature-request/pdf
 */
export async function sendPdfForSignature(
  params: SendPdfForSignatureParams
): Promise<SendPdfForSignatureResponse> {
  try {
    logger.info(
      {
        apiUrl: Config.simpleSign.apiUrl,
        hasToken: !!Config.simpleSign.accessToken,
        tokenLength: Config.simpleSign.accessToken?.length || 0,
      },
      'SimpleSign config'
    )

    const formData = new FormData()

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(params.pdfBase64, 'base64')
    formData.append('file', pdfBuffer, {
      filename: 'document.pdf',
      contentType: 'application/pdf',
    })

    // Add recipient data
    const recipients = [
      {
        people_fields: {
          firstname: params.recipientName?.split(' ')[0] || 'Tenant',
          lastname: params.recipientName?.split(' ').slice(1).join(' ') || '',
          email: params.recipientEmail,
          mobile: '',
          address: '',
          city: '',
          zipcode: '',
          persnol_no: '',
        },
        details: {
          recipient_role: 'Tenant',
          authentication: 'e_signature',
          invitation_type: 'email',
          invitation_order: '1',
          confirmation: 'email',
        },
      },
    ]

    formData.append('recipients', JSON.stringify(recipients))
    formData.append('language', 'swedish')
    formData.append('due_days', '5')
    formData.append('reminder_days', '3')

    const response = await axios.post(
      `${Config.simpleSign.apiUrl}/signature-request/pdf`,
      formData,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${Config.simpleSign.accessToken}`,
          ...formData.getHeaders(),
        },
      }
    )

    return response.data as SendPdfForSignatureResponse
  } catch (error: any) {
    logger.error(
      { error: error.response?.data || error.message },
      'SimpleSign API error'
    )
    throw new Error(
      `SimpleSign API error: ${error.response?.status || 'unknown'}`
    )
  }
}

/**
 * Get document details from SimpleSign
 * GET /document/details?documentId={id}
 */
export async function getDocumentDetails(
  documentId: number
): Promise<DocumentDetails> {
  try {
    const response = await axios.get(
      `${Config.simpleSign.apiUrl}/document/details`,
      {
        params: { documentId },
        headers: {
          Authorization: `Bearer ${Config.simpleSign.accessToken}`,
        },
      }
    )

    return response.data as DocumentDetails
  } catch (error: any) {
    logger.error(
      { error: error.response?.data || error.message },
      'SimpleSign API error'
    )
    throw new Error(
      `SimpleSign API error: ${error.response?.status || 'unknown'}`
    )
  }
}

/**
 * Download signed PDF from SimpleSign
 * GET /documents/{documentId}/download-pdf
 */
export async function downloadSignedPdf(documentId: number): Promise<Buffer> {
  try {
    const response = await axios.get(
      `${Config.simpleSign.apiUrl}/documents/${documentId}/download-pdf`,
      {
        headers: {
          Authorization: `Bearer ${Config.simpleSign.accessToken}`,
        },
        responseType: 'arraybuffer',
      }
    )

    return Buffer.from(response.data)
  } catch (error: any) {
    logger.error(
      { error: error.response?.data || error.message },
      'SimpleSign API error'
    )
    throw new Error(
      `SimpleSign API error: ${error.response?.status || 'unknown'}`
    )
  }
}
