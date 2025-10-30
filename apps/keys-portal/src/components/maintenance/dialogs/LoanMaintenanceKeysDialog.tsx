import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'
import type { KeyWithMaintenanceLoanStatus, Contact } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import {
  searchContacts,
  fetchContactByContactCode,
} from '@/services/api/contactService'
import { useDebounce } from '@/utils/debounce'
import { maintenanceKeysService } from '@/services/api/maintenanceKeysService'
import { BeforeAfterDialogBase } from '@/components/loan/dialogs/BeforeAfterDialogBase'
import {
  SearchDropdown,
  type SearchDropdownItem,
} from '@/components/ui/search-dropdown'

interface LoanMaintenanceKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keys: KeyWithMaintenanceLoanStatus[] // Keys to loan out
  allBundleKeys?: KeyWithMaintenanceLoanStatus[] // All keys in bundle for pre-suggestions
  onSuccess: () => void
}

export function LoanMaintenanceKeysDialog({
  open,
  onOpenChange,
  keys,
  allBundleKeys,
  onSuccess,
}: LoanMaintenanceKeysDialogProps) {
  const { toast } = useToast()
  const [companySearch, setCompanySearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<Contact[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Contact | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [contactPerson, setContactPerson] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [recentCompanies, setRecentCompanies] = useState<Contact[]>([])

  // Fetch companies that have active loans on keys in the bundle (for pre-suggestions)
  useEffect(() => {
    const fetchRecentCompanies = async () => {
      // Use allBundleKeys if provided, otherwise fall back to keys
      const keysToCheck = allBundleKeys || keys

      // Get unique company codes from keys that have active maintenance loans
      const companyCodes = new Set<string>()
      keysToCheck.forEach((key) => {
        if (key.maintenanceLoan?.company) {
          companyCodes.add(key.maintenanceLoan.company)
        }
      })

      // Fetch full contact info for each unique company
      const companies = await Promise.all(
        Array.from(companyCodes).map((code) => fetchContactByContactCode(code))
      )

      setRecentCompanies(companies.filter((c): c is Contact => c !== null))
    }

    if (open && (allBundleKeys?.length || keys.length > 0)) {
      fetchRecentCompanies()
    }
  }, [open, keys, allBundleKeys])

  // Debounce company search
  const updateDebouncedSearch = useDebounce((query: string) => {
    setDebouncedSearch(query)
  }, 300)

  useEffect(() => {
    updateDebouncedSearch(companySearch.trim())
  }, [companySearch, updateDebouncedSearch])

  // Search for companies when debounced search changes
  useEffect(() => {
    // Don't search if company is already selected
    if (selectedCompany) {
      setCompanySuggestions([])
      return
    }

    if (debouncedSearch.length < 3) {
      setCompanySuggestions([])
      return
    }

    const search = async () => {
      setIsSearching(true)
      try {
        const results = await searchContacts(debouncedSearch, 'company')
        setCompanySuggestions(results)
      } catch (error) {
        console.error('Error searching contacts:', error)
        setCompanySuggestions([])
      } finally {
        setIsSearching(false)
      }
    }

    search()
  }, [debouncedSearch, selectedCompany])

  const handleSelectCompany = (company: Contact) => {
    setSelectedCompany(company)
    // Format: Name · Code · Org number
    const displayText = [
      company.fullName,
      company.contactCode,
      company.organisationNumber,
    ]
      .filter(Boolean)
      .join(' · ')
    setCompanySearch(displayText)
    setShowSuggestions(false)
    setCompanySuggestions([]) // Clear suggestions
    setDebouncedSearch('') // Stop further searches
  }

  const handleClearCompany = () => {
    setSelectedCompany(null)
    setCompanySearch('')
    setShowSuggestions(false)
    setDebouncedSearch('')
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

      await maintenanceKeysService.create({
        keys: JSON.stringify(keyIds),
        company: selectedCompany.contactCode,
        contactPerson: contactPerson.trim() || null,
        description: description.trim() || null,
      })

      toast({
        title: 'Lån skapat',
        description: `${keys.length} ${keys.length === 1 ? 'nyckel' : 'nycklar'} har lånats ut till ${selectedCompany.fullName}`,
      })

      // Reset form
      handleReset()
      onSuccess()
    } catch (error) {
      console.error('Error creating maintenance loan:', error)
      toast({
        title: 'Kunde inte skapa lån',
        description: 'Ett fel uppstod när lånet skulle skapas',
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
    setShowSuggestions(false)
    setRecentCompanies([])
    onOpenChange(false)
  }

  // Combine server results with pre-suggestions
  const allCompanies = useMemo(() => {
    // Don't show anything if company is already selected
    if (selectedCompany) {
      return []
    }

    const trimmed = companySearch.trim()

    // If empty, show all pre-suggestions
    if (trimmed.length === 0) {
      return recentCompanies
    }

    // Filter pre-suggestions based on search
    const filteredPreSuggestions = recentCompanies.filter((c) => {
      const searchText =
        `${c.fullName} ${c.contactCode} ${c.organisationNumber || ''}`.toLowerCase()
      return searchText.includes(trimmed.toLowerCase())
    })

    // If below min length for server search, only show filtered pre-suggestions
    if (trimmed.length < 3) {
      return filteredPreSuggestions
    }

    // At 3+ chars, combine filtered pre-suggestions with server results
    // Remove duplicates (pre-suggestions take priority)
    const preSuggestionCodes = new Set(
      filteredPreSuggestions.map((c) => c.contactCode)
    )
    const uniqueServerResults = companySuggestions.filter(
      (c) => !preSuggestionCodes.has(c.contactCode)
    )

    return [...filteredPreSuggestions, ...uniqueServerResults]
  }, [companySearch, recentCompanies, companySuggestions, selectedCompany])

  // Format items for dropdown and track pre-suggestions count
  const { dropdownItems, preSuggestionsCount } = useMemo(() => {
    const items = allCompanies.map((company) => {
      const isPreSuggestion = recentCompanies.includes(company)
      return {
        value: company,
        primaryText: company.fullName || company.contactCode,
        secondaryText: `${company.contactCode}${company.organisationNumber ? ` · ${company.organisationNumber}` : ''}${isPreSuggestion ? ' · Aktivt lån' : ''}`,
        searchableText: `${company.fullName} ${company.contactCode} ${company.organisationNumber || ''}`,
        isPreSuggestion,
      }
    })

    // Count how many pre-suggestions are at the start (they're already at the top from allCompanies logic)
    let count = 0
    for (const item of items) {
      if (item.isPreSuggestion) {
        count++
      } else {
        break // Pre-suggestions should be contiguous at the start
      }
    }

    return { dropdownItems: items, preSuggestionsCount: count }
  }, [allCompanies, recentCompanies])

  // Determine if we should show the dropdown
  const shouldShowDropdown = useMemo(() => {
    if (!showSuggestions) return false
    if (selectedCompany) return false

    const trimmed = companySearch.trim()

    // For pre-suggestions (< 3 chars), only show if we have items
    if (trimmed.length < 3) {
      return dropdownItems.length > 0
    }

    // For server search (>= 3 chars), always show (loading, results, or empty state)
    return true
  }, [showSuggestions, selectedCompany, companySearch, dropdownItems.length])

  const rightContent = (
    <div className="space-y-4">
      {/* Company Search */}
      <div className="space-y-2 relative">
        <Label htmlFor="company">
          Företag <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="company"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay to allow click events on dropdown items to fire first
              setTimeout(() => setShowSuggestions(false), 200)
            }}
            placeholder="Sök företag (F-nummer eller namn)..."
            disabled={isSubmitting}
            autoComplete="off"
          />
          {selectedCompany && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={handleClearCompany}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Search dropdown */}
          <SearchDropdown
            show={shouldShowDropdown}
            isSearching={isSearching}
            items={dropdownItems}
            preSuggestionsCount={preSuggestionsCount}
            onSelect={handleSelectCompany}
            emptyMessage="Inga företag hittades"
            loadingMessage="Söker företag..."
          />
        </div>
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
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivning (valfritt)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="T.ex. Entreprenörsnycklar för renoveringsprojekt Blocket A"
          rows={4}
          disabled={isSubmitting}
        />
      </div>
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
