import { useState, useEffect, useCallback, useRef } from 'react'
import { Search } from 'lucide-react'
import { searchContacts } from '@/services/api/contactService'
import { searchKeyBundles } from '@/services/api/keyBundleService'
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
import type { Contact } from '@/services/types'
import type { KeyBundle } from '@/services/api/keyBundleService'

type SearchResult =
  | { type: 'contact'; data: Contact }
  | { type: 'bundle'; data: KeyBundle }

interface UnifiedMaintenanceSearchProps {
  onSelectContact: (contactCode: string) => void
  onSelectBundle: (bundleId: string, bundleName: string) => void
  loading?: boolean
}

/**
 * Unified search component for maintenance keys page.
 * Searches both contacts (by contact code/name) and key bundles (by name).
 * Shows dropdown suggestions grouped by type.
 */
export function UnifiedMaintenanceSearch({
  onSelectContact,
  onSelectBundle,
  loading = false,
}: UnifiedMaintenanceSearchProps) {
  const [searchValue, setSearchValue] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounce the query update
  const updateDebouncedQuery = useDebounce((query: string) => {
    setDebouncedQuery(query)
  }, 300)

  useEffect(() => {
    updateDebouncedQuery(searchValue.trim())
  }, [searchValue, updateDebouncedQuery])

  // Search contacts
  const contactsQuery = useSearch(
    (query: string) => searchContacts(query),
    'search-contacts-maintenance',
    debouncedQuery,
    { minLength: 3 }
  )

  // Search key bundles
  const bundlesQuery = useSearch(
    (query: string) => searchKeyBundles(query),
    'search-bundles-maintenance',
    debouncedQuery,
    { minLength: 3 }
  )

  const contacts = contactsQuery.data || []
  const bundles = bundlesQuery.data || []
  const isSearching = contactsQuery.isFetching || bundlesQuery.isFetching

  // Filter out contacts that start with 'P' (only show companies with F-codes)
  const filteredContacts = contacts.filter((c) =>
    c.contactCode?.toUpperCase().startsWith('F')
  )

  // Combine results with type tags
  const allResults: SearchResult[] = [
    ...filteredContacts.map((c) => ({ type: 'contact' as const, data: c })),
    ...bundles.map((b) => ({ type: 'bundle' as const, data: b })),
  ]

  // Show suggestions when we have results
  useEffect(() => {
    if (allResults.length > 0) {
      setShowSuggestions(true)
      setSelectedIndex(-1)
    } else if (debouncedQuery.length >= 3 && !isSearching) {
      setShowSuggestions(true)
    } else if (debouncedQuery.length < 3) {
      setShowSuggestions(false)
    }
  }, [allResults.length, debouncedQuery, isSearching])

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
    (result: SearchResult) => {
      setShowSuggestions(false)
      setSearchValue('')
      setDebouncedQuery('')
      setSelectedIndex(-1)

      if (result.type === 'contact') {
        onSelectContact(result.data.contactCode)
      } else {
        onSelectBundle(result.data.id, result.data.name)
      }
    },
    [onSelectContact, onSelectBundle]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || allResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < allResults.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < allResults.length) {
          handleSelect(allResults[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const formatContact = (contact: Contact) => {
    const isCompany = contact.contactCode?.toUpperCase().startsWith('F')
    return {
      primary: contact.fullName || 'Okänt namn',
      secondary: `${contact.contactCode} • ${isCompany ? 'Org.nr' : 'Pers.nr'}: ${contact.nationalRegistrationNumber}`,
      badge: 'Kontakt',
    }
  }

  const formatBundle = (bundle: KeyBundle) => {
    let keyCount = 0
    try {
      const keyIds = JSON.parse(bundle.keys)
      keyCount = Array.isArray(keyIds) ? keyIds.length : 0
    } catch (e) {
      keyCount = 0
    }

    return {
      primary: bundle.name,
      secondary: bundle.description
        ? `${bundle.description} • ${keyCount} nycklar`
        : `${keyCount} nycklar`,
      badge: 'Nyckelsamling',
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Sök kontakt eller nyckelsamling
        </CardTitle>
        <CardDescription>
          Ange företag (F-nummer) eller nyckelsamling för att hitta lån
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Företag eller nyckelsamling..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (allResults.length > 0) {
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
              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[400px] overflow-y-auto"
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
                allResults.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Inga företag eller nyckelsamlingar hittades
                  </div>
                )}

              {!isSearching && allResults.length > 0 && (
                <div className="p-1">
                  {allResults.map((result, index) => {
                    const formatted =
                      result.type === 'contact'
                        ? formatContact(result.data)
                        : formatBundle(result.data)

                    return (
                      <div
                        key={
                          result.type === 'contact'
                            ? `contact-${result.data.contactCode}`
                            : `bundle-${result.data.id}`
                        }
                        className={`px-3 py-2 cursor-pointer rounded-sm transition-colors ${
                          index === selectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {formatted.primary}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                result.type === 'contact'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {formatted.badge}
                            </span>
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
            <strong>Företag:</strong> FXXXXXX (t.ex. F088710, F123456)
          </p>
          <p>
            <strong>Nyckelsamling:</strong> Namn på nyckelsamling (t.ex. "FS
            huvudnycklar")
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
