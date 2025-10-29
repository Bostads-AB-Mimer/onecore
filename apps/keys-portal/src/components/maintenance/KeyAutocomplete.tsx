import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { keyService } from '@/services/api/keyService'
import { useSearch } from '@/hooks/useSearch'
import { useDebounce } from '@/utils/debounce'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'

interface KeyAutocompleteProps {
  selectedKeys: Key[]
  onAddKey: (key: Key) => void
  onRemoveKey: (keyId: string) => void
  disabled?: boolean
}

/**
 * Autocomplete component for searching and selecting multiple keys.
 * Searches by key name or rental object code.
 * Shows selected keys as badges that can be removed.
 */
export function KeyAutocomplete({
  selectedKeys,
  onAddKey,
  onRemoveKey,
  disabled = false,
}: KeyAutocompleteProps) {
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

  // Use the search hook with React Query
  const keysQuery = useSearch(
    async (query: string) => {
      const results = await keyService.searchKeys({
        q: query,
        disposed: 'false',
      })
      return results.content
    },
    'search-keys-for-maintenance',
    debouncedQuery,
    { minLength: 3 }
  )

  const suggestions = keysQuery.data || []
  const isSearching = keysQuery.isFetching

  // Filter out already selected keys from suggestions
  const selectedKeyIds = new Set(selectedKeys.map((k) => k.id))
  const filteredSuggestions = suggestions.filter(
    (key) => !selectedKeyIds.has(key.id)
  )

  useEffect(() => {
    if (keysQuery.data && filteredSuggestions.length > 0) {
      setShowSuggestions(true)
      setSelectedIndex(-1)
    } else if (debouncedQuery.length >= 3 && !keysQuery.isFetching) {
      setShowSuggestions(true)
    } else if (debouncedQuery.length < 3) {
      setShowSuggestions(false)
    }
  }, [keysQuery.data, debouncedQuery, keysQuery.isFetching, filteredSuggestions.length])

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
    (key: Key) => {
      setShowSuggestions(false)
      setSearchValue('')
      setDebouncedQuery('')
      setSelectedIndex(-1)
      onAddKey(key)
      inputRef.current?.focus()
    },
    [onAddKey]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          handleSelect(filteredSuggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div className="space-y-3">
      {/* Selected Keys Display */}
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedKeys.map((key) => (
            <Badge
              key={key.id}
              variant="secondary"
              className="pl-3 pr-1 py-1.5 flex items-center gap-2"
            >
              <span className="text-sm">
                {key.keyName}
                {key.rentalObjectCode && (
                  <span className="text-muted-foreground ml-1">
                    ({key.rentalObjectCode})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemoveKey(key.id)}
                disabled={disabled}
                className="hover:bg-muted rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Sök nyckelnamn eller hyresobjekt..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (filteredSuggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            disabled={disabled}
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
                Söker nycklar...
              </div>
            )}

            {!isSearching && searchValue.trim().length < 3 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Skriv minst 3 tecken för att söka
              </div>
            )}

            {!isSearching &&
              searchValue.trim().length >= 3 &&
              filteredSuggestions.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {selectedKeyIds.size > 0 && suggestions.length > 0
                    ? 'Alla hittade nycklar är redan valda'
                    : 'Inga nycklar hittades'}
                </div>
              )}

            {!isSearching && filteredSuggestions.length > 0 && (
              <div className="p-1">
                {filteredSuggestions.map((key, index) => (
                  <div
                    key={key.id}
                    className={`px-3 py-2 cursor-pointer rounded-sm transition-colors ${
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => handleSelect(key)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="font-medium text-sm">{key.keyName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{KeyTypeLabels[key.keyType]}</span>
                        {key.rentalObjectCode && (
                          <>
                            <span>•</span>
                            <span>{key.rentalObjectCode}</span>
                          </>
                        )}
                        {key.flexNumber && (
                          <>
                            <span>•</span>
                            <span>Flex: {key.flexNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Sök på nyckelnamn (t.ex. "FS-001") eller hyresobjekt (t.ex. "705-011")
      </p>
    </div>
  )
}
