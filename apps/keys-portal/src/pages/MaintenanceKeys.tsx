import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { useContactCodeSearch } from '@/components/maintenance/ContactCodeSearch'
import { SearchInput } from '@/components/loan/SearchInput'
import { ContactInfoCard } from '@/components/loan/ContactInfoCard'
import { Button } from '@/components/ui/button'
import type { Contact } from '@/services/types'

export default function MaintenanceKeys() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const scrollToResults = () =>
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    )

  const handleResultFound = (contact: Contact | null, searchValue: string) => {
    setSelectedContact(contact)

    // Update URL params
    setSearchParams({ contact: searchValue })

    scrollToResults()
  }

  const handleClearSearch = () => {
    setSelectedContact(null)
    setSearchParams({})
  }

  const { searchValue, setSearchValue, handleSearch, loading } =
    useContactCodeSearch({
      onResultFound: handleResultFound,
    })

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-2xl mx-auto">
        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          onSearch={handleSearch}
          loading={loading}
          placeholder="Kontaktnummer (PXXXXXX eller FXXXXXX)"
          title="Sök kontakt"
          description="Ange kontaktnummer för att hitta kontakt"
          helpText={
            <>
              <p>
                Kundnummer: PXXXXXX eller FXXXXXX (t.ex. P053602 eller F123456)
              </p>
            </>
          }
        />
      </div>

      {/* Show results when contact is found */}
      {selectedContact && (
        <div ref={resultsRef} className="border-t pt-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Sökresultat</h2>
              <Button variant="outline" size="sm" onClick={handleClearSearch}>
                <X className="h-4 w-4 mr-2" />
                Rensa sökning
              </Button>
            </div>

            <div className="max-w-2xl">
              <ContactInfoCard contacts={[selectedContact]} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
