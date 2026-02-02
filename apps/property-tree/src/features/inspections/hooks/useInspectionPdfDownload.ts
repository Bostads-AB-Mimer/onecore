import { useState } from 'react'
import { inspectionService } from '@/services/api/core/inspectionService'
import { downloadFileFromBase64 } from '@/utils/fileDownload'

export interface UseInspectionPdfDownloadReturn {
  downloadPdf: (inspectionId: string, filename?: string) => Promise<void>
  isDownloading: boolean
  error: Error | null
}

export function useInspectionPdfDownload(): UseInspectionPdfDownloadReturn {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const downloadPdf = async (inspectionId: string, filename?: string) => {
    try {
      setIsDownloading(true)
      setError(null)
      const pdfBase64 = await inspectionService.getInspectionPdfBase64(
        inspectionId
      )
      downloadFileFromBase64(
        pdfBase64,
        filename || `besiktningsprotokoll-${inspectionId}.pdf`,
        'application/pdf'
      )
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to download PDF')
      setError(error)
      console.error('Failed to download PDF:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  return {
    downloadPdf,
    isDownloading,
    error,
  }
}
