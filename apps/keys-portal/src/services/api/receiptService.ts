import { authConfig } from '@/auth-config'

import type {
  Receipt,
  CreateReceiptRequest,
  UploadFileResponse,
  DownloadUrlResponse,
} from '../types'
import { GET, POST, DELETE } from './core/base-api'

export const receiptService = {
  /**
   * Create a new receipt
   */
  async create(payload: CreateReceiptRequest): Promise<Receipt> {
    const { data, error } = await POST('/receipts', { body: payload })
    if (error) throw error
    return data?.content as Receipt
  },

  /**
   * Get all receipts for a key loan ID
   */
  async getByKeyLoan(keyLoanId: string): Promise<Receipt[]> {
    const { data, error } = await GET('/receipts/by-key-loan/{keyLoanId}', {
      params: { path: { keyLoanId } },
    })
    if (error) {
      if ((error as any)?.status === 404) return []
      throw error
    }
    return (data?.content ?? []) as Receipt[]
  },

  /**
   * Delete a receipt (also deletes associated file from MinIO if it exists)
   */
  async remove(id: string): Promise<void> {
    const { error } = await DELETE('/receipts/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },

  /**
   * Upload a PDF file to a receipt
   */
  async uploadFile(receiptId: string, file: File): Promise<UploadFileResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(
      `${authConfig.apiUrl}/receipts/${receiptId}/upload`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || errorData.reason || 'Failed to upload file'
      )
    }

    const result = await response.json()
    return result.content as UploadFileResponse
  },

  /**
   * Get a presigned download URL for a receipt's PDF file
   * The URL expires after 7 days
   */
  async getDownloadUrl(receiptId: string): Promise<DownloadUrlResponse> {
    const { data, error } = await GET('/receipts/{id}/download', {
      params: { path: { id: receiptId } },
    })
    if (error) throw error
    return data?.content as DownloadUrlResponse
  },

  /**
   * Download a receipt's PDF file
   */
  async downloadFile(receiptId: string): Promise<void> {
    const { url } = await this.getDownloadUrl(receiptId)
    window.open(url, '_blank')
  },

  /**
   * Get all receipts for a specific lease's rental object
   * Fetches keyLoans for the rental object, then fetches receipts for each keyLoan
   */
  async listByLease(rentalObjectCode: string): Promise<Receipt[]> {
    const { keyLoanService } = await import('./keyLoanService')

    // Get all keyLoans for this rental object
    const { loaned, returned } =
      await keyLoanService.listByLease(rentalObjectCode)
    const allKeyLoans = [...loaned, ...returned]

    // Fetch receipts for each keyLoan
    const receiptsArrays = await Promise.all(
      allKeyLoans.map((loan) => this.getByKeyLoan(loan.id))
    )

    // Flatten and deduplicate
    const allReceipts = receiptsArrays.flat()
    const uniqueReceipts = Array.from(
      new Map(allReceipts.map((r) => [r.id, r])).values()
    )

    return uniqueReceipts
  },
}
