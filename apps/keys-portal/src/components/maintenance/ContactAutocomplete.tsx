import { useState, useEffect, useCallback, useRef } from 'react'
import { Search } from 'lucide-react'
import { searchContacts } from '@/services/api/contactService'
import { useSearch } from '@/hooks/useSearch'
import { useDebounce } from '@/utils/debounce'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ContactSuggestion {
  contactCode: string
  fullName: string
  nationalRegistrationNumber: string
}

interface ContactAutocompleteProps {
  onSelect: (contactCode: string) => void
  loading?: boolean
}

/**
 * Autocomplete component for searching contacts by name, contact code, or organization number.
 * Shows dropdown suggestions as user types directly in the input field.
 * Uses useSearch hook with React Query for caching and error handling.
 */
export function ContactAutocomplete({
  onSelect,
  loading = false,
}: ContactAutocompleteProps) {
  // Search query state: immediate and debounced (matching key system pattern)
  const [searchValue, setSearchValue] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounce the query update (300ms delay for responsive UX)
  const updateDebouncedQuery = useDebounce((query: string) => {
    setDebouncedQuery(query)
  }, 300)

  // Update debounced query when user types
  useEffect(() => {
    updateDebouncedQuery(searchValue.trim())
  }, [searchValue, updateDebouncedQuery])

  // Use the search hook with React Query (minimum 3 characters)
  const contactsQuery = useSearch(
    (query: string) => searchContacts(query),
    'search-contacts',
    debouncedQuery,
    { minLength: 3 }
  )

  // Get results and loading state from React Query
  const suggestions = contactsQuery.data || []
  const isSearching = contactsQuery.isFetching

  // Show suggestions when we have results or need to show messages
  useEffect(() => {
    if (contactsQuery.data && contactsQuery.data.length > 0) {
      setShowSuggestions(true)
      setSelectedIndex(-1)
    } else if (debouncedQuery.length >= 3 && !contactsQuery.isFetching) {
      // Show dropdown even if empty (to show "no results" message)
      setShowSuggestions(true)
    } else if (debouncedQuery.length < 3) {
      setShowSuggestions(false)
    }
  }, [contactsQuery.data, debouncedQuery, contactsQuery.isFetching])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (contactCode: string) => {
      setShowSuggestions(false)
      setSearchValue('')
      setDebouncedQuery('')
      setSelectedIndex(-1)
      onSelect(contactCode)
    },
    [onSelect]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex].contactCode)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const formatSuggestion = (suggestion: ContactSuggestion) => {
    const isCompany = suggestion.contactCode?.toUpperCase().startsWith('F')
    return {
      primary: suggestion.fullName || 'Okänt namn',
      secondary: `${suggestion.contactCode} • ${isCompany ? 'Org.nr' : 'Pers.nr'}: ${suggestion.nationalRegistrationNumber}`,
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
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Kontaktnummer (PXXXXXX eller FXXXXXX)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              disabled={loading}
              className="pl-10"
            />
          </div>

          {/* Dropdown suggestions */}
          {showSuggestions && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto"
            >
              {isSearching && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Söker...
                </div>
              )}

              {!isSearching && searchValue.trim().length < 3 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Skriv minst 3 tecken för att söka
                </div>
              )}

              {!isSearching &&
                searchValue.trim().length >= 3 &&
                suggestions.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Inga kontakter hittades
                  </div>
                )}

              {!isSearching && suggestions.length > 0 && (
                <div className="p-1">
                  {suggestions.map((suggestion, index) => {
                    const formatted = formatSuggestion(suggestion)
                    return (
                      <div
                        key={suggestion.contactCode}
                        className={`px-3 py-2 cursor-pointer rounded-sm transition-colors ${
                          index === selectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onClick={() => handleSelect(suggestion.contactCode)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium text-sm">
                            {formatted.primary}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatted.secondary}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Kundnummer: PXXXXXX eller FXXXXXX (t.ex. P053602 eller F123456)
          </p>
          <p>
            <strong>Tips:</strong> Du kan också söka på företagsnamn (t.ex. "Certego")
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
