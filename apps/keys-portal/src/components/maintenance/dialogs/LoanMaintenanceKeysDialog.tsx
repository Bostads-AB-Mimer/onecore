import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { KeyDetails, Contact } from '@/services/types'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'
import { useToast } from '@/hooks/use-toast'
import {
  searchContacts,
  fetchContactByContactCode,
} from '@/services/api/contactService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'
import { BeforeAfterDialogBase } from '@/components/loan/dialogs/BeforeAfterDialogBase'
import { ReceiptDialog } from '@/components/loan/dialogs/ReceiptDialog'
import { SearchDropdown } from '@/components/ui/search-dropdown'

interface LoanMaintenanceKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keys: KeyDetails[] // Keys to loan out
  allBundleKeys?: KeyDetails[] // All keys in bundle for pre-suggestions
  preSelectedCompany?: Contact // Pre-selected company (e.g. from contact search page)
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

  // Form state
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Contact | null>(null)
  const [contactPerson, setContactPerson] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-suggestions state
  const [recentCompanies, setRecentCompanies] = useState<Contact[]>([])

  // Receipt dialog state
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null)

  // Set pre-selected company when dialog opens
  useEffect(() => {
    if (open && preSelectedCompany) {
      handleSelectCompany(preSelectedCompany)
    }
  }, [open, preSelectedCompany])

  // Fetch companies that have active loans on keys in the bundle (for pre-suggestions)
  useEffect(() => {
    const fetchRecentCompanies = async () => {
      // Use allBundleKeys if provided, otherwise fall back to keys
      const keysToCheck = allBundleKeys || keys

      // Get unique company codes from keys that have active maintenance loans
      const companyCodes = new Set<string>()
      keysToCheck.forEach((key) => {
        key.loans?.forEach((loan) => {
          if (loan.loanType === 'MAINTENANCE' && loan.contact) {
            companyCodes.add(loan.contact)
          }
        })
      })

      // Fetch full contact info for each unique company
      const companies = await Promise.all(
        Array.from(companyCodes).map((code) => fetchContactByContactCode(code))
      )

      setRecentCompanies(companies.filter((c): c is Contact => c !== null))
    }

    if (
      open &&
      (allBundleKeys?.length || keys.length > 0) &&
      !preSelectedCompany
    ) {
      fetchRecentCompanies()
    }
  }, [open, keys, allBundleKeys, preSelectedCompany])

  const handleSelectCompany = (company: Contact | null) => {
    setSelectedCompany(company)

    if (company) {
      // Format: Name · Code · National registration number
      const displayText = [
        company.fullName,
        company.contactCode,
        company.nationalRegistrationNumber,
      ]
        .filter(Boolean)
        .join(' · ')
      setCompanySearch(displayText)
    }
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

    setIsSubmitting(true)

    try {
      const keyIds = keys.map((k) => k.id)
      const payload = {
        keys: keyIds,
        loanType: 'MAINTENANCE' as const,
        contact: selectedCompany.contactCode,
        contactPerson: contactPerson.trim() || null,
        description: addSignature(description) || null,
      }

      const created = await keyLoanService.create(payload)

      // Create receipt for this loan (non-blocking — loan succeeds even if this fails)
      try {
        await receiptService.create({
          keyLoanId: created.id,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })
      } catch (receiptErr) {
        console.error('Failed to create receipt:', receiptErr)
      }

      toast({
        title: 'Lån skapat',
        description: `${keys.length} ${keys.length === 1 ? 'nyckel' : 'nycklar'} har lånats ut till ${selectedCompany.fullName}`,
      })

      // Show receipt dialog instead of immediately closing
      setCreatedLoanId(created.id)
    } catch (error) {
      console.error('Error creating maintenance loan:', error)
      toast({
        title: 'Kunde inte skapa lån',
        description:
          error instanceof Error
            ? error.message
            : 'Ett fel uppstod när lånet skulle skapas',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setCompanySearch('')
    setSelectedCompany(null)
    setContactPerson('')
    setDescription('')
    setRecentCompanies([])
    setCreatedLoanId(null)
    onOpenChange(false)
  }

  const handleReceiptClose = () => {
    handleReset()
    onSuccess()
  }

  // Show receipt dialog after loan creation
  if (createdLoanId) {
    return (
      <ReceiptDialog
        isOpen={true}
        onClose={handleReceiptClose}
        loanType="MAINTENANCE"
        loanId={createdLoanId}
      />
    )
  }

  const rightContent = (
    <div className="space-y-4">
      {/* Company Search */}
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

      {/* Contact Person */}
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

      {/* Description */}
      <CommentInput
        value={description}
        onChange={setDescription}
        label="Beskrivning (valfritt)"
        placeholder="T.ex. Entreprenörsnycklar för renoveringsprojekt Blocket A"
        rows={4}
      />
    </div>
  )

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Låna ut nycklar till entreprenör"
      description={`Välj företag och fyll i detaljer för lånet av ${keys.length} ${keys.length === 1 ? 'nyckel' : 'nycklar'}`}
      selectedKeys={keys}
      leftTitle={`Valda nycklar (${keys.length})`}
      rightTitle="Låneinformation"
      rightContent={rightContent}
      isProcessing={isSubmitting}
      onAccept={handleAccept}
      acceptButtonText="Skapa lån"
      totalCount={keys.length}
    />
  )
}
