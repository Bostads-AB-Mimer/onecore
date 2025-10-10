import { useEffect, useState, useRef } from 'react'
import { KeyRound, Clock } from 'lucide-react'

import type {
  Lease,
  KeyLoan,
  Key,
  Receipt,
  ReceiptData,
} from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { receiptService } from '@/services/api/receiptService'
import { generateLoanReceipt, generateReturnReceipt } from '@/lib/pdf-receipts'
import { KeyLoanCard } from './KeyLoanCard'
import { PartialReturnDialog } from './PartialReturnDialog'

interface KeyLoansAccordionProps {
  lease: Lease
}

interface KeyLoanWithDetails {
  keyLoan: KeyLoan
  keys: Key[]
  receipts: Receipt[]
  loanReceipt?: Receipt
  returnReceipt?: Receipt
}

export function KeyLoansAccordion({ lease }: KeyLoansAccordionProps) {
  const [keyLoans, setKeyLoans] = useState<KeyLoanWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(
    null
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activePartialReturnLoanId, setActivePartialReturnLoanId] = useState<
    string | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadReceiptIdRef = useRef<string | null>(null)

  const fetchKeyLoans = async () => {
    setLoading(true)
    try {
      // Fetch all key loans for this lease's rental object
      const { loaned, returned } = await keyLoanService.listByLease(
        lease.rentalPropertyId
      )
      const allKeyLoans = [...loaned, ...returned]

      // Enrich each key loan with key details and receipts
      const enriched: KeyLoanWithDetails[] = []
      for (const keyLoan of allKeyLoans) {
        try {
          const keyIds: string[] = JSON.parse(keyLoan.keys || '[]')

          // Fetch key details
          const keys: Key[] = []
          for (const keyId of keyIds) {
            try {
              const key = await keyService.getKey(keyId)
              keys.push(key)
            } catch (err) {
              console.error(`Failed to fetch key ${keyId}:`, err)
            }
          }

          // Fetch receipts for this key loan
          const receipts = await receiptService.getByKeyLoan(keyLoan.id)
          const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
          const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

          enriched.push({
            keyLoan,
            keys,
            receipts,
            loanReceipt,
            returnReceipt,
          })
        } catch (err) {
          console.error(`Failed to enrich key loan ${keyLoan.id}:`, err)
        }
      }

      setKeyLoans(enriched)
    } catch (err) {
      console.error('Failed to fetch key loans:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeyLoans()
  }, [lease.leaseId])

  const handleGenerateLoanReceipt = async (
    loanWithDetails: KeyLoanWithDetails
  ) => {
    const receiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys: loanWithDetails.keys,
      receiptType: 'LOAN',
      operationDate: loanWithDetails.keyLoan.createdAt
        ? new Date(loanWithDetails.keyLoan.createdAt)
        : new Date(),
    }

    // Create receipt record if it doesn't exist
    if (!loanWithDetails.loanReceipt) {
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanWithDetails.keyLoan.id,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })
        await generateLoanReceipt(receiptData, receipt.id)
        await fetchKeyLoans() // Refresh
      } catch (err) {
        console.error('Failed to create loan receipt:', err)
      }
    } else {
      // Just regenerate the PDF
      await generateLoanReceipt(receiptData, loanWithDetails.loanReceipt.id)
    }
  }

  const handleGenerateReturnReceipt = async (
    loanWithDetails: KeyLoanWithDetails
  ) => {
    const receiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys: loanWithDetails.keys,
      receiptType: 'RETURN',
      operationDate: loanWithDetails.keyLoan.returnedAt
        ? new Date(loanWithDetails.keyLoan.returnedAt)
        : new Date(),
    }

    // Create receipt record if it doesn't exist
    if (!loanWithDetails.returnReceipt) {
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanWithDetails.keyLoan.id,
          receiptType: 'RETURN',
          type: 'PHYSICAL',
        })
        await generateReturnReceipt(receiptData, receipt.id)
        await fetchKeyLoans() // Refresh
      } catch (err) {
        console.error('Failed to create return receipt:', err)
      }
    } else {
      // Just regenerate the PDF
      await generateReturnReceipt(receiptData, loanWithDetails.returnReceipt.id)
    }
  }

  const handleDownloadReceipt = async (receipt: Receipt) => {
    try {
      await receiptService.downloadFile(receipt.id)
    } catch (err) {
      console.error('Failed to download receipt:', err)
    }
  }

  const handleUploadReceipt = async (receiptId: string, file: File) => {
    setUploadError(null)
    setUploadingReceiptId(receiptId)
    try {
      // Validate file
      if (file.type !== 'application/pdf') {
        setUploadError('Endast PDF-filer är tillåtna')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Filen är för stor (max 10 MB)')
        return
      }

      await receiptService.uploadFile(receiptId, file)
      await fetchKeyLoans() // Refresh to show updated status
    } catch (err: any) {
      setUploadError(err?.message ?? 'Kunde inte ladda upp filen')
    } finally {
      setUploadingReceiptId(null)
    }
  }

  const onPickFile = (receiptId: string) => {
    pendingUploadReceiptIdRef.current = receiptId
    fileInputRef.current?.click()
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    const receiptId = pendingUploadReceiptIdRef.current
    if (file && receiptId) {
      void handleUploadReceipt(receiptId, file)
    }
    // Reset
    pendingUploadReceiptIdRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePartialReturn = async (
    loanWithDetails: KeyLoanWithDetails,
    selectedKeyIds: string[],
    isReplacement: boolean
  ) => {
    setUploadError(null)

    try {
      const allKeys = loanWithDetails.keys
      const returnedKeys = allKeys.filter((k) => selectedKeyIds.includes(k.id))
      const missingKeys = allKeys.filter((k) => !selectedKeyIds.includes(k.id))

      // Step 1: Mark original loan as returned (all keys marked as returned in DB)
      await keyLoanService.update(loanWithDetails.keyLoan.id, {
        returnedAt: new Date().toISOString(),
      })

      // Step 2: Generate return receipt (missing keys documented on PDF only)
      const returnReceiptData: ReceiptData = {
        lease,
        tenants: lease.tenants ?? [],
        keys: returnedKeys,
        missingKeys: missingKeys.length > 0 ? missingKeys : undefined,
        receiptType: 'RETURN',
        operationDate: new Date(),
      }

      const returnReceipt = await receiptService.create({
        keyLoanId: loanWithDetails.keyLoan.id,
        receiptType: 'RETURN',
        type: 'PHYSICAL',
      })

      await generateReturnReceipt(returnReceiptData, returnReceipt.id)

      // Step 3: If replacement mode, create new loan immediately
      if (isReplacement) {
        const newLoan = await keyLoanService.create({
          keys: JSON.stringify(allKeys.map((k) => k.id)), // ALL keys (with replacement)
          contact: lease.tenants?.[0]
            ? `${lease.tenants[0].firstName} ${lease.tenants[0].lastName}`
            : '',
          contact2: lease.tenants?.[1]
            ? `${lease.tenants[1].firstName} ${lease.tenants[1].lastName}`
            : '',
          pickedUpAt: null, // Pending signature
        })

        // Generate new loan receipt
        const loanReceiptData: ReceiptData = {
          lease,
          tenants: lease.tenants ?? [],
          keys: allKeys, // All keys including replacement
          receiptType: 'LOAN',
          operationDate: new Date(),
        }

        const loanReceipt = await receiptService.create({
          keyLoanId: newLoan.id,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })

        await generateLoanReceipt(loanReceiptData, loanReceipt.id)
      }

      // Refresh and close dialog
      await fetchKeyLoans()
      setActivePartialReturnLoanId(null)
    } catch (err: any) {
      console.error('Failed to process partial return:', err)
      setUploadError(err?.message ?? 'Kunde inte skapa returkvitto')
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Laddar nyckellån...
      </div>
    )
  }

  if (keyLoans.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Inga nyckellån hittades</p>
      </div>
    )
  }

  const activeLoanWithDetails = keyLoans.find(
    (loan) => loan.keyLoan.id === activePartialReturnLoanId
  )

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

        {keyLoans.map((loanWithDetails) => {
          const hasUnsignedLoanReceipt =
            loanWithDetails.loanReceipt && !loanWithDetails.loanReceipt.fileId
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
              onToggleReturnAccordion={() =>
                setActivePartialReturnLoanId(
                  activePartialReturnLoanId === loanWithDetails.keyLoan.id
                    ? null
                    : loanWithDetails.keyLoan.id
                )
              }
              onUploadReceipt={onPickFile}
              onDownloadReceipt={handleDownloadReceipt}
              isReturnAccordionOpen={false}
            />
          )
        })}
      </div>

      {/* Partial Return Dialog */}
      {activeLoanWithDetails && (
        <PartialReturnDialog
          open={activePartialReturnLoanId !== null}
          onOpenChange={(open) => {
            if (!open) setActivePartialReturnLoanId(null)
          }}
          keys={activeLoanWithDetails.keys}
          onConfirm={async (selectedKeyIds, isReplacement) => {
            await handlePartialReturn(
              activeLoanWithDetails,
              selectedKeyIds,
              isReplacement
            )
          }}
        />
      )}
    </>
  )
}
