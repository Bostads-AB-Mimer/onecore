import { useState } from 'react'
import { Search } from 'lucide-react'
import { searchContacts } from '@/services/api/contactService'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import type { Contact } from '@/services/types'

interface ContactAutocompleteProps {
  onSelect: (contactCode: string) => void
  loading?: boolean
}

/**
 * Autocomplete component for searching contacts by name, contact code, or national registration number.
 * Shows dropdown suggestions as user types directly in the input field.
 */
export function ContactAutocomplete({
  onSelect,
  loading = false,
}: ContactAutocompleteProps) {
  const [searchValue, setSearchValue] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const handleSelect = (contact: Contact | null) => {
    if (contact) {
      setSelectedContact(contact)
      // Format display text
      const displayText = [
        contact.fullName,
        contact.contactCode,
        contact.nationalRegistrationNumber,
      ]
        .filter(Boolean)
        .join(' · ')
      setSearchValue(displayText)
      // Notify parent with contact code
      onSelect(contact.contactCode)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Sök kontakt
        </CardTitle>
        <CardDescription>
          Ange kontaktnummer för att hitta kontakt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchDropdown
          preSuggestions={[]} // No pre-suggestions for contact search
          searchFn={(query) => searchContacts(query)}
          minSearchLength={3}
          debounceMs={300}
          formatItem={(contact) => {
            const isCompany = contact.contactCode?.toUpperCase().startsWith('F')
            return {
              primaryText: contact.fullName || 'Okänt namn',
              secondaryText: `${contact.contactCode} · ${isCompany ? 'Org.nr' : 'Pers.nr'}: ${contact.nationalRegistrationNumber}`,
              searchableText: `${contact.fullName} ${contact.contactCode} ${contact.nationalRegistrationNumber}`,
            }
          }}
          getKey={(contact) => contact.contactCode}
          value={searchValue}
          onChange={setSearchValue}
          onSelect={handleSelect}
          selectedValue={selectedContact}
          placeholder="Kontaktnummer (PXXXXXX eller FXXXXXX)"
          emptyMessage="Inga kontakter hittades"
          loadingMessage="Söker..."
          disabled={loading}
        />

        <div className="text-sm text-muted-foreground space-y-1">
          <p>Kundnummer: PXXXXXX eller FXXXXXX (t.ex. P053602 eller F123456)</p>
          <p>
            <strong>Tips:</strong> Du kan också söka på företagsnamn (t.ex.
            "Certego")
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
