import { useState, useRef, useEffect } from 'react'
import { KeyRound, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { Lease, Receipt, ReceiptData, Key } from '@/services/types'
import { receiptService } from '@/services/api/receiptService'
import { openPdfInNewTab } from '@/lib/receiptPdfUtils'
import { KeyLoanCard } from './KeyLoanCard'
import { useKeyLoans, type KeyLoanWithDetails } from '@/hooks/useKeyLoans'

interface KeyLoansAccordionProps {
  lease: Lease
  refreshKey?: number
  onUnsignedLoansChange?: (hasUnsignedLoans: boolean) => void
  preloadedKeys?: Key[]
}

export function KeyLoansAccordion({
  lease,
  refreshKey,
  onUnsignedLoansChange,
  preloadedKeys,
}: KeyLoansAccordionProps) {
  const {
    activeLoans,
    returnedLoans,
    loading,
    refresh,
    fetchReturnedLoansReceipts,
  } = useKeyLoans(lease, onUnsignedLoansChange, preloadedKeys)

  const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(
    null
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showReturnedLoans, setShowReturnedLoans] = useState(false)
  const [returnedLoading, setReturnedLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadReceiptIdRef = useRef<string | null>(null)

  // Refresh when refreshKey changes
  // Note: We intentionally use refreshKey as the only dependency to avoid
  // re-fetching when the refresh callback reference changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  /**
   * Handles toggling the returned loans accordion
   * Lazy-loads receipts for returned loans on first expand
   */
  const handleToggleReturnedLoans = async () => {
    const willShow = !showReturnedLoans

    // If we're about to show returned loans, check if we need to fetch receipts
    if (willShow) {
      // Check if any returned loan needs receipts
      const needsReceipts = returnedLoans.some(
        (loan) => loan.receipts.length === 0
      )

      if (needsReceipts) {
        setReturnedLoading(true)
        await fetchReturnedLoansReceipts()
        setReturnedLoading(false)
      }
    }

    setShowReturnedLoans(willShow)
  }

  /**
   * Handles generating or downloading a loan receipt
   * If signed receipt exists (has fileId), downloads from MinIO
   * Otherwise, generates PDF client-side and opens in new tab
   */
  const handleGenerateLoanReceipt = async (
    loanWithDetails: KeyLoanWithDetails
  ) => {
    // If a signed receipt exists (has fileId), download it from MinIO
    if (loanWithDetails.loanReceipt && loanWithDetails.loanReceipt.fileId) {
      try {
        await receiptService.downloadFile(loanWithDetails.loanReceipt.id)
        return
      } catch (err) {
        console.error('Failed to download signed receipt:', err)
        // Fall through to generate PDF if download fails
      }
    }

    // Otherwise, generate the receipt PDF client-side
    const baseReceiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys: loanWithDetails.keys,
      receiptType: 'LOAN',
      operationDate: loanWithDetails.keyLoan.createdAt
        ? new Date(loanWithDetails.keyLoan.createdAt)
        : new Date(),
    }

    if (!loanWithDetails.loanReceipt) {
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanWithDetails.keyLoan.id,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })

        await refresh()

        // Open PDF directly in new tab
        await openPdfInNewTab(baseReceiptData, receipt.id)
      } catch (err) {
        console.error('Failed to create loan receipt:', err)
      }
    } else {
      // Open PDF directly in new tab
      await openPdfInNewTab(baseReceiptData, loanWithDetails.loanReceipt.id)
    }
  }

  /**
   * Handles generating or downloading a return receipt
   * If signed receipt exists (has fileId), downloads from MinIO
   * Otherwise, generates PDF client-side and opens in new tab
   */
  const handleGenerateReturnReceipt = async (
    loanWithDetails: KeyLoanWithDetails
  ) => {
    // If a signed receipt exists (has fileId), download it from MinIO
    if (loanWithDetails.returnReceipt && loanWithDetails.returnReceipt.fileId) {
      try {
        await receiptService.downloadFile(loanWithDetails.returnReceipt.id)
        return
      } catch (err) {
        console.error('Failed to download signed return receipt:', err)
        // Fall through to generate PDF if download fails
      }
    }

    // Otherwise, generate the receipt PDF client-side
    const baseReceiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys: loanWithDetails.keys,
      receiptType: 'RETURN',
      operationDate: loanWithDetails.keyLoan.returnedAt
        ? new Date(loanWithDetails.keyLoan.returnedAt)
        : new Date(),
    }

    if (!loanWithDetails.returnReceipt) {
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanWithDetails.keyLoan.id,
          receiptType: 'RETURN',
          type: 'PHYSICAL',
        })

        await refresh()

        // Open PDF directly in new tab
        await openPdfInNewTab(baseReceiptData, receipt.id)
      } catch (err) {
        console.error('Failed to create return receipt:', err)
      }
    } else {
      // Open PDF directly in new tab
      await openPdfInNewTab(baseReceiptData, loanWithDetails.returnReceipt.id)
    }
  }

  /**
   * Downloads a receipt file from MinIO
   */
  const handleDownloadReceipt = async (receipt: Receipt) => {
    try {
      await receiptService.downloadFile(receipt.id)
    } catch (err) {
      console.error('Failed to download receipt:', err)
    }
  }

  /**
   * Handles uploading a signed receipt file
   */
  const handleUploadReceipt = async (receiptId: string, file: File) => {
    setUploadError(null)
    setUploadingReceiptId(receiptId)
    try {
      if (file.type !== 'application/pdf') {
        setUploadError('Endast PDF-filer är tillåtna')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Filen är för stor (max 10 MB)')
        return
      }

      await receiptService.uploadFile(receiptId, file)
      await refresh()
    } catch (err: any) {
      setUploadError(err?.message ?? 'Kunde inte ladda upp filen')
    } finally {
      setUploadingReceiptId(null)
    }
  }

  /**
   * Triggers file picker for receipt upload
   */
  const onPickFile = (receiptId: string) => {
    pendingUploadReceiptIdRef.current = receiptId
    fileInputRef.current?.click()
  }

  /**
   * Handles file selection from file picker
   */
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    const receiptId = pendingUploadReceiptIdRef.current
    if (file && receiptId) {
      void handleUploadReceipt(receiptId, file)
    }
    pendingUploadReceiptIdRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Laddar nyckellån...
      </div>
    )
  }

  if (activeLoans.length === 0 && returnedLoans.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Inga nyckellån hittades</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileInputChange}
        />

        {/* Active loans - always visible */}
        {activeLoans.length > 0 && (
          <div className="space-y-2">
            {activeLoans.map((loanWithDetails) => {
              const hasUnsignedLoanReceipt =
                loanWithDetails.loanReceipt &&
                !loanWithDetails.loanReceipt.fileId
              const isActive = !loanWithDetails.keyLoan.returnedAt

              return (
                <KeyLoanCard
                  key={loanWithDetails.keyLoan.id}
                  keyLoan={loanWithDetails.keyLoan}
                  keys={loanWithDetails.keys}
                  receipts={loanWithDetails.receipts}
                  loanReceipt={loanWithDetails.loanReceipt}
                  returnReceipt={loanWithDetails.returnReceipt}
                  isActive={isActive}
                  hasUnsignedLoanReceipt={hasUnsignedLoanReceipt}
                  uploadingReceiptId={uploadingReceiptId}
                  uploadError={uploadError}
                  onGenerateLoanReceipt={() =>
                    handleGenerateLoanReceipt(loanWithDetails)
                  }
                  onGenerateReturnReceipt={() =>
                    handleGenerateReturnReceipt(loanWithDetails)
                  }
                  onUploadReceipt={onPickFile}
                  onDownloadReceipt={handleDownloadReceipt}
                />
              )
            })}
          </div>
        )}

        {/* No active loans message */}
        {activeLoans.length === 0 && returnedLoans.length > 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>Inga aktiva nyckellån</p>
          </div>
        )}

        {/* Returned loans - collapsible section */}
        {returnedLoans.length > 0 && (
          <div className="mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleReturnedLoans}
              disabled={returnedLoading}
              className="w-full h-8 text-xs gap-2"
            >
              {returnedLoading ? (
                <>
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                  Laddar kvitton...
                </>
              ) : showReturnedLoans ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Dölj återlämnade lån ({returnedLoans.length})
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Visa återlämnade lån ({returnedLoans.length})
                </>
              )}
            </Button>

            {showReturnedLoans && (
              <div className="space-y-2 mt-2">
                {returnedLoans.map((loanWithDetails) => {
                  const hasUnsignedLoanReceipt =
                    loanWithDetails.loanReceipt &&
                    !loanWithDetails.loanReceipt.fileId
                  const isActive = !loanWithDetails.keyLoan.returnedAt

                  return (
                    <KeyLoanCard
                      key={loanWithDetails.keyLoan.id}
                      keyLoan={loanWithDetails.keyLoan}
                      keys={loanWithDetails.keys}
                      receipts={loanWithDetails.receipts}
                      loanReceipt={loanWithDetails.loanReceipt}
                      returnReceipt={loanWithDetails.returnReceipt}
                      isActive={isActive}
                      hasUnsignedLoanReceipt={hasUnsignedLoanReceipt}
                      uploadingReceiptId={uploadingReceiptId}
                      uploadError={uploadError}
                      onGenerateLoanReceipt={() =>
                        handleGenerateLoanReceipt(loanWithDetails)
                      }
                      onGenerateReturnReceipt={() =>
                        handleGenerateReturnReceipt(loanWithDetails)
                      }
                      onUploadReceipt={onPickFile}
                      onDownloadReceipt={handleDownloadReceipt}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
