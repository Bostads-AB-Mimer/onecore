import { blobToBase64 } from '@/utils/fileUtils'

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
   * Create a new receipt and upload its file. Two backend calls — POST /receipts
   * ignores fileData on creation, so we create the row first and then push the
   * bytes through /receipts/{id}/upload.
   */
  async createWithFile(
    payload: Omit<CreateReceiptRequest, 'fileData' | 'fileContentType'>,
    file: File
  ): Promise<Receipt> {
    const receipt = await this.create(payload)
    const { fileId } = await this.uploadFile(receipt.id, file)
    return { ...receipt, fileId }
  },

  /**
   * Get a receipt by ID
   */
  async getById(receiptId: string): Promise<Receipt> {
    const { data, error } = await GET('/receipts/{id}', {
      params: { path: { id: receiptId } },
    })
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
   * Upload a PDF file to a receipt using base64 encoding
   */
  async uploadFile(receiptId: string, file: File): Promise<UploadFileResponse> {
    const base64Content = await blobToBase64(file)

    const { data, error } = await POST('/receipts/{id}/upload', {
      params: { path: { id: receiptId } },
      body: {
        fileData: base64Content,
        fileContentType: file.type || 'application/pdf',
      },
    })
    if (error) throw error
    return data?.content as UploadFileResponse
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
   */
  async listByLease(rentalObjectCode: string): Promise<Receipt[]> {
    const { keyLoanService } = await import('./keyLoanService')

    const allKeyLoans = await keyLoanService.getByRentalObject(rentalObjectCode)

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
