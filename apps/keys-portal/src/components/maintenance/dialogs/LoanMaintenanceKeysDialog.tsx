import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { KeyDetails, Contact } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { cn } from '@/lib/utils'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'
import { useToast } from '@/hooks/use-toast'
import {
  searchContacts,
  fetchContactByContactCode,
} from '@/services/api/contactService'
import { BeforeAfterDialogBase } from '@/components/loan/dialogs/BeforeAfterDialogBase'
import { ReceiptDialog } from '@/components/loan/dialogs/ReceiptDialog'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { Checkbox } from '@/components/ui/checkbox'
import { useActiveLoanCheck } from '@/hooks/useActiveLoanCheck'
import { useCreateMaintenanceLoan } from '@/hooks/useCreateMaintenanceLoan'

interface LoanMaintenanceKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keys: KeyDetails[]
  allBundleKeys?: KeyDetails[]
  preSelectedCompany?: Contact
  onSuccess: () => void
}

export function LoanMaintenanceKeysDialog({
  open,
  onOpenChange,
  keys,
  allBundleKeys,
  preSelectedCompany,
  onSuccess,
}: LoanMaintenanceKeysDialogProps) {
  const { toast } = useToast()
  const { addSignature } = useCommentWithSignature()

  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Contact | null>(null)
  const [contactPerson, setContactPerson] = useState('')
  const [description, setDescription] = useState('')
  const [recentCompanies, setRecentCompanies] = useState<Contact[]>([])
  const [checkedKeyIds, setCheckedKeyIds] = useState<Set<string>>(new Set())

  const { loanedKeyIds, isChecking } = useActiveLoanCheck(keys, open)
  const { isSubmitting, createdLoanId, create, reset } =
    useCreateMaintenanceLoan()

  // Pre-select a passed-in company and check all keys when the dialog opens.
  useEffect(() => {
    if (open && preSelectedCompany) handleSelectCompany(preSelectedCompany)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preSelectedCompany])

  useEffect(() => {
    if (open && keys.length > 0)
      setCheckedKeyIds(new Set(keys.map((k) => k.id)))
  }, [open, keys])

  // Companies with an active maintenance loan on these keys, for pre-suggestions.
  useEffect(() => {
    if (!open || preSelectedCompany) return
    const keysToCheck = allBundleKeys || keys
    if (keysToCheck.length === 0) return

    const fetchRecent = async () => {
      const companyCodes = new Set<string>()
      keysToCheck.forEach((key) =>
        key.loans?.forEach((loan) => {
          if (loan.loanType === 'MAINTENANCE' && loan.contact)
            companyCodes.add(loan.contact)
        })
      )
      const companies = await Promise.all(
        Array.from(companyCodes).map((code) => fetchContactByContactCode(code))
      )
      setRecentCompanies(companies.filter((c): c is Contact => c !== null))
    }
    fetchRecent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keys, allBundleKeys, preSelectedCompany])

  const handleSelectCompany = (company: Contact | null) => {
    setSelectedCompany(company)
    if (company) {
      setCompanySearch(
        [
          company.fullName,
          company.contactCode,
          company.nationalRegistrationNumber,
        ]
          .filter(Boolean)
          .join(' · ')
      )
    }
  }

  const resetForm = () => {
    setCompanySearch('')
    setSelectedCompany(null)
    setContactPerson('')
    setDescription('')
    setRecentCompanies([])
    setCheckedKeyIds(new Set())
    reset()
  }

  const handleAccept = async () => {
    if (!selectedCompany) {
      toast({
        title: 'Inget företag valt',
        description: 'Du måste välja ett företag från sökresultaten',
        variant: 'destructive',
      })
      return
    }
    // On success the receipt dialog opens (createdLoanId); the dialog stays mounted.
    await create({
      keyIds: Array.from(checkedKeyIds),
      company: selectedCompany,
      contactPerson: contactPerson.trim() || null,
      description: addSignature(description) || null,
    })
  }

  const handleReceiptClose = () => {
    resetForm()
    onOpenChange(false)
    onSuccess()
  }

  // After creation, swap to the receipt-print dialog (unified — takes the loan id).
  if (createdLoanId) {
    return (
      <ReceiptDialog
        isOpen
        onClose={handleReceiptClose}
        loanId={createdLoanId}
      />
    )
  }

  const toggleKey = (keyId: string) => {
    // Loaned keys can be unchecked but not re-checked.
    if (loanedKeyIds.has(keyId) && !checkedKeyIds.has(keyId)) return
    setCheckedKeyIds((prev) => {
      const next = new Set(prev)
      if (next.has(keyId)) next.delete(keyId)
      else next.add(keyId)
      return next
    })
  }

  const hasCheckedLoaned = keys.some(
    (k) => loanedKeyIds.has(k.id) && checkedKeyIds.has(k.id)
  )

  const leftContent = (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {isChecking && (
        <div className="text-sm text-muted-foreground py-2">
          Kontrollerar lånestatus…
        </div>
      )}
      {keys.map((key) => {
        const isLoaned = loanedKeyIds.has(key.id)
        const isChecked = checkedKeyIds.has(key.id)
        return (
          <label
            key={key.id}
            className={cn(
              'flex items-center gap-3 p-3 border rounded-lg text-sm cursor-pointer',
              isLoaned
                ? isChecked
                  ? 'border-destructive/50 bg-destructive/5'
                  : 'border-destructive/50 bg-destructive/5 opacity-60 cursor-not-allowed'
                : isChecked
                  ? 'bg-muted/50'
                  : 'bg-background opacity-60'
            )}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => toggleKey(key.id)}
              disabled={isLoaned && !isChecked}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-medium">{key.keyName}</div>
                {isLoaned && (
                  <span className="text-xs font-medium text-destructive">
                    Utlånad
                  </span>
                )}
              </div>
              <div className="text-muted-foreground">
                {KeyTypeLabels[key.keyType]}
                {key.keySystem?.systemCode && ` • ${key.keySystem.systemCode}`}
                {key.flexNumber !== undefined && ` • Flex: ${key.flexNumber}`}
                {key.keySequenceNumber !== undefined &&
                  ` • Löpnr: ${key.keySequenceNumber}`}
              </div>
            </div>
          </label>
        )
      })}
      {!isChecking && hasCheckedLoaned && (
        <p className="text-xs text-destructive mt-2">
          Avmarkera utlånade nycklar för att kunna skapa lånet.
        </p>
      )}
    </div>
  )

  const rightContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company">
          Företag <span className="text-destructive">*</span>
        </Label>
        <SearchDropdown
          preSuggestions={recentCompanies}
          searchFn={(query) => searchContacts(query, 'company')}
          minSearchLength={3}
          debounceMs={300}
          formatItem={(contact) => ({
            primaryText: contact.fullName || contact.contactCode,
            secondaryText: `${contact.contactCode}${contact.nationalRegistrationNumber ? ` · ${contact.nationalRegistrationNumber}` : ''}`,
            searchableText: `${contact.fullName} ${contact.contactCode} ${contact.nationalRegistrationNumber || ''}`,
          })}
          getKey={(contact) => contact.contactCode}
          preSuggestionLabel="Aktivt lån"
          value={companySearch}
          onChange={setCompanySearch}
          onSelect={handleSelectCompany}
          selectedValue={selectedCompany}
          placeholder="Sök företag (F-nummer eller namn)..."
          emptyMessage="Inga företag hittades"
          loadingMessage="Söker företag..."
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactPerson">Kontaktperson (valfritt)</Label>
        <Input
          id="contactPerson"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="T.ex. Anders Svensson"
          disabled={isSubmitting}
        />
      </div>

      <CommentInput
        value={description}
        onChange={setDescription}
        label="Beskrivning (valfritt)"
        placeholder="T.ex. Nycklar för renoveringsprojekt Blocket A"
        rows={4}
      />
    </div>
  )

  const checkedCount = checkedKeyIds.size

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Låna ut nycklar"
      description={`Välj företag och fyll i detaljer för lånet av ${keys.length} ${keys.length === 1 ? 'nyckel' : 'nycklar'}`}
      leftContent={leftContent}
      leftTitle={`Valda nycklar (${checkedCount} av ${keys.length})`}
      rightTitle="Låneinformation"
      rightContent={rightContent}
      isProcessing={isSubmitting}
      onAccept={handleAccept}
      acceptButtonText="Skapa lån"
      totalCount={checkedCount}
      acceptDisabled={isChecking || !selectedCompany || hasCheckedLoaned}
    />
  )
}
