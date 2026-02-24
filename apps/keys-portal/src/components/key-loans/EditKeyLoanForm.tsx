import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  KeyLoan,
  KeyLoanWithDetails,
  UpdateKeyLoanRequest,
  Receipt,
} from '@/services/types'
import { receiptService } from '@/services/api/receiptService'
import { X, FileText, Download, Trash2, Upload } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

type EditKeyLoanFormProps = {
  onSave: (
    loanData: UpdateKeyLoanRequest,
    receiptFile?: File | null
  ) => void | Promise<void>
  onCancel: () => void
  editingKeyLoan: KeyLoan
  onReceiptUpload?: (loanId: string, file: File) => Promise<void>
  onReceiptDownload?: (loanId: string) => Promise<void>
  onReceiptDelete?: (loanId: string) => Promise<void>
}

export function EditKeyLoanForm({
  onSave,
  onCancel,
  editingKeyLoan,
  onReceiptUpload,
  onReceiptDownload,
  onReceiptDelete,
}: EditKeyLoanFormProps) {
  const [formData, setFormData] = useState<UpdateKeyLoanRequest>({
    contact: editingKeyLoan.contact || '',
    contact2: editingKeyLoan.contact2 || '',
    loanType: editingKeyLoan.loanType,
    contactPerson: editingKeyLoan.contactPerson || '',
    notes: editingKeyLoan.notes || '',
    pickedUpAt: editingKeyLoan.pickedUpAt
      ? format(new Date(editingKeyLoan.pickedUpAt), 'yyyy-MM-dd')
      : '',
    returnedAt: editingKeyLoan.returnedAt
      ? format(new Date(editingKeyLoan.returnedAt), 'yyyy-MM-dd')
      : '',
    availableToNextTenantFrom: editingKeyLoan.availableToNextTenantFrom
      ? format(new Date(editingKeyLoan.availableToNextTenantFrom), 'yyyy-MM-dd')
      : '',
  })

  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(
    null
  )
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [loanReceipt, setLoanReceipt] = useState<Receipt | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load receipt info on mount
  useEffect(() => {
    const loadReceipt = async () => {
      try {
        const receipts = await receiptService.getByKeyLoan(editingKeyLoan.id)
        setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
      } catch (error) {
        console.error('Failed to load receipt:', error)
      } finally {
        setLoadingReceipt(false)
      }
    }
    loadReceipt()
  }, [editingKeyLoan.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if user is clearing pickedUpAt (reverting to "Ej upphämtat")
    const isClearingPickedUpAt =
      editingKeyLoan.pickedUpAt && !formData.pickedUpAt

    if (isClearingPickedUpAt) {
      if (
        !confirm(
          'Du har tagit bort upphämtat datum. Kvittensen kommer att raderas och lånet markeras som ej upphämtat. Är du säker?'
        )
      ) {
        return
      }

      // Delete the receipt if it exists
      if (onReceiptDelete) {
        try {
          await onReceiptDelete(editingKeyLoan.id)
        } catch (error) {
          console.error('Failed to delete receipt:', error)
          // Continue anyway - the loan will still be updated
        }
      }
    }

    // Check if user is clearing returnedAt (reactivating the loan)
    const isClearingReturnedAt =
      editingKeyLoan.returnedAt && !formData.returnedAt

    if (isClearingReturnedAt) {
      if (
        !confirm(
          'Du har tagit bort återlämnat datum, detta kommer återaktivera lånet. Är du säker?'
        )
      ) {
        return
      }
    }

    // Destructure to exclude pickedUpAt from the spread (we'll add it conditionally)
    const { pickedUpAt: _pickedUpAt, ...restFormData } = formData

    // Convert date strings to ISO format
    const loanData: UpdateKeyLoanRequest = {
      ...restFormData,
      contactPerson: formData.contactPerson?.trim() || null,
      notes: formData.notes?.trim() || null,
      returnedAt: formData.returnedAt
        ? new Date(formData.returnedAt).toISOString()
        : null,
      availableToNextTenantFrom: formData.availableToNextTenantFrom
        ? new Date(formData.availableToNextTenantFrom).toISOString()
        : null,
    }

    // Only include pickedUpAt in the update if:
    // 1. User is clearing it (already handled above with receipt deletion)
    // 2. User is manually editing an existing date
    // 3. No receipt exists (prevents overwriting backend-set pickedUpAt)
    if (isClearingPickedUpAt) {
      // User wants to clear it - set to null
      loanData.pickedUpAt = null
    } else if (
      editingKeyLoan.pickedUpAt &&
      formData.pickedUpAt &&
      formData.pickedUpAt !== editingKeyLoan.pickedUpAt
    ) {
      // User is manually editing an existing date
      loanData.pickedUpAt = new Date(formData.pickedUpAt).toISOString()
    } else if (!loanReceipt?.fileId && formData.pickedUpAt) {
      // No receipt exists but user has entered a date - allow it
      loanData.pickedUpAt = new Date(formData.pickedUpAt).toISOString()
    }
    // Otherwise, don't include pickedUpAt in the update (preserve backend value)

    // Pass the receipt file along with the form data
    await onSave(loanData, selectedReceiptFile)
  }

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file
      if (file.type !== 'application/pdf') {
        alert('Endast PDF-filer är tillåtna')
        e.target.value = ''
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Filen är för stor (max 10 MB)')
        e.target.value = ''
        return
      }
      setSelectedReceiptFile(file)
    }
  }

  const handleUploadReceipt = async () => {
    if (!selectedReceiptFile || !onReceiptUpload) return

    setIsUploadingReceipt(true)
    try {
      await onReceiptUpload(editingKeyLoan.id, selectedReceiptFile)
      setSelectedReceiptFile(null)

      // Refresh receipt info
      const receipts = await receiptService.getByKeyLoan(editingKeyLoan.id)
      setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
    } finally {
      setIsUploadingReceipt(false)
    }
  }

  const handleDownloadReceipt = async () => {
    if (!onReceiptDownload) return
    await onReceiptDownload(editingKeyLoan.id)
  }

  const handleDeleteReceipt = async () => {
    if (!onReceiptDelete) return
    if (
      !confirm(
        'Är du säker på att du vill ta bort kvittensen? Lånet kommer markeras som ej upphämtat.'
      )
    ) {
      return
    }

    await onReceiptDelete(editingKeyLoan.id)

    // Clear pickedUpAt from form state since loan is now "Ej upphämtat"
    setFormData((prev) => ({
      ...prev,
      pickedUpAt: '',
    }))

    // Refresh receipt info
    const receipts = await receiptService.getByKeyLoan(editingKeyLoan.id)
    setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
  }

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'Ej satt'
    try {
      return format(new Date(dateString), 'PPP', { locale: sv })
    } catch {
      return 'Ogiltigt datum'
    }
  }

  // Get key count from keysArray if available
  const getKeyCount = () => {
    const withDetails = editingKeyLoan as KeyLoanWithDetails
    if (withDetails.keysArray) {
      return withDetails.keysArray.length
    }
    return '-'
  }

  return (
    <Card className="animate-fade-in mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Redigera nyckellån</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Loan type and created date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="loanType" className="text-xs">
                Låntyp *
              </Label>
              <Select
                value={formData.loanType}
                onValueChange={(value: 'TENANT' | 'MAINTENANCE') =>
                  setFormData((prev) => ({ ...prev, loanType: value }))
                }
              >
                <SelectTrigger id="loanType" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">Hyresgäst</SelectItem>
                  <SelectItem value="MAINTENANCE">Underhåll</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Skapad</Label>
              <div className="flex items-center h-8 px-3 rounded-md border border-input bg-muted">
                <span className="text-sm">
                  {formatDate(editingKeyLoan.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Contact information - read-only */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="contact" className="text-xs">
                Kontakt *
              </Label>
              <Input
                id="contact"
                className="h-8"
                value={formData.contact}
                readOnly
                disabled
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="contact2" className="text-xs">
                Kontakt 2
              </Label>
              <Input
                id="contact2"
                className="h-8"
                value={formData.contact2}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* Maintenance-specific fields */}
          {formData.loanType === 'MAINTENANCE' && (
            <div className="space-y-3 pt-2">
              <h3 className="font-medium text-sm">Underhållsinformation</h3>

              <div className="space-y-1">
                <Label htmlFor="contactPerson" className="text-xs">
                  Kontaktperson (valfritt)
                </Label>
                <Input
                  id="contactPerson"
                  className="h-8"
                  placeholder="T.ex. Anders Svensson"
                  value={formData.contactPerson || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contactPerson: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">
                  Notering (valfritt)
                </Label>
                <Textarea
                  id="notes"
                  rows={4}
                  placeholder="T.ex. Nycklar förvaltning för renoveringsprojekt Blocket A"
                  value={formData.notes || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-3 pt-2">
            <h3 className="font-medium text-sm">Datum</h3>

            {/* pickedUpAt - editable if exists */}
            <div className="space-y-1">
              <Label htmlFor="pickedUpAt" className="text-xs">
                Upphämtat
              </Label>
              {editingKeyLoan.pickedUpAt ? (
                <Input
                  id="pickedUpAt"
                  type="date"
                  className="h-8"
                  value={formData.pickedUpAt}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      pickedUpAt: e.target.value,
                    }))
                  }
                />
              ) : (
                <div className="flex items-center h-8 px-3 rounded-md border border-input bg-muted">
                  <span className="text-sm text-muted-foreground">
                    Ej upphämtat - ladda upp kvittens för att aktivera
                  </span>
                </div>
              )}
            </div>

            {/* returnedAt - only show for returned loans */}
            {editingKeyLoan.returnedAt && (
              <div className="space-y-1">
                <Label htmlFor="returnedAt" className="text-xs">
                  Återlämnat
                </Label>
                <Input
                  id="returnedAt"
                  type="date"
                  className="h-8"
                  value={formData.returnedAt}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      returnedAt: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            {/* availableToNextTenantFrom - only for returned loans */}
            {editingKeyLoan.returnedAt && (
              <div className="space-y-1">
                <Label htmlFor="availableToNextTenantFrom" className="text-xs">
                  Tillgänglig från och med
                </Label>
                <Input
                  id="availableToNextTenantFrom"
                  type="date"
                  className="h-8"
                  value={formData.availableToNextTenantFrom}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      availableToNextTenantFrom: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  När nycklarna kan lämnas ut till nästa hyresgäst
                </p>
              </div>
            )}
          </div>

          {/* Receipt management */}
          <div className="space-y-3 pt-2">
            {loadingReceipt ? (
              <div className="text-sm text-muted-foreground">
                Laddar kvittens...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Show current receipt if exists and no new file selected */}
                {loanReceipt?.fileId && !selectedReceiptFile && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                    <FileText className="h-4 w-4" />
                    <span className="flex-1 text-xs">Kvittens uppladdad</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleDownloadReceipt}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Ladda ner
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={handleDeleteReceipt}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* File input for new upload/replace */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">
                    Kvittens (PDF)
                  </Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="text-sm flex-1"
                    onChange={handleReceiptFileChange}
                  />
                </div>

                {selectedReceiptFile && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 flex-1 truncate">
                        {selectedReceiptFile.name}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedReceiptFile(null)
                          if (fileInputRef.current)
                            fileInputRef.current.value = ''
                        }}
                        variant="ghost"
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Warning when replacing existing receipt */}
                    {loanReceipt?.fileId && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                        <p className="font-medium text-yellow-800">
                          Obs! Det befintliga kvittensen kommer att raderas
                        </p>
                      </div>
                    )}

                    {/* Upload button - only show if file selected */}
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs h-7"
                      onClick={handleUploadReceipt}
                      disabled={isUploadingReceipt}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {isUploadingReceipt
                        ? 'Laddar upp...'
                        : loanReceipt?.fileId
                          ? 'Ersätt kvittens'
                          : 'Ladda upp kvittens'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Keys info (read-only) */}
          <div className="space-y-1 pt-2">
            <h3 className="font-medium text-sm">Nycklar i detta lån</h3>
            <div className="text-sm text-muted-foreground">
              {getKeyCount()} {getKeyCount() === 1 ? 'nyckel' : 'nycklar'}
            </div>
          </div>

          {/* Form actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Avbryt
            </Button>
            <Button type="submit">Uppdatera</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
