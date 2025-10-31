import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useDebounce } from '@/utils/debounce'

export interface SearchDropdownDisplayFormat {
  primaryText: string
  secondaryText?: string
  searchableText?: string // For client-side filtering, defaults to primaryText
}

interface SearchDropdownProps<T> {
  // Data
  preSuggestions: T[] // Raw data objects to show before/during search

  // Search configuration
  searchFn: (query: string) => Promise<T[]> // Server search function
  minSearchLength?: number // Minimum characters before server search (default: 3)
  debounceMs?: number // Debounce delay in ms (default: 300)

  // Formatting
  formatItem: (item: T) => SearchDropdownDisplayFormat
  getKey?: (item: T) => string // For deduplication (default: JSON.stringify)
  preSuggestionLabel?: string // Label to append to pre-suggestions (e.g., "Aktivt lån")

  // Selection & Input (controlled)
  value: string // Input value
  onChange: (value: string) => void
  onSelect: (item: T | null) => void // Called when item selected or cleared
  selectedValue?: T | null // Currently selected item

  // Focus/Blur
  onFocus?: () => void
  onBlur?: () => void

  // UI Customization
  placeholder?: string
  emptyMessage?: string // Default: "Inga resultat"
  loadingMessage?: string // Default: "Söker..."
  disabled?: boolean
  showClearButton?: boolean // Default: true when selectedValue exists
  className?: string
}

/**
 * Smart search dropdown component with pre-suggestions and server search.
 *
 * Features:
 * - Shows pre-suggestions immediately (client-side filtering)
 * - Triggers server search at minSearchLength threshold
 * - Combines pre-suggestions + server results (deduplicates)
 * - Handles debouncing, loading states, and empty states
 * - Fully generic and reusable
 */
export function SearchDropdown<T>({
  preSuggestions,
  searchFn,
  minSearchLength = 3,
  debounceMs = 300,
  formatItem,
  getKey = (item) => JSON.stringify(item),
  preSuggestionLabel,
  value,
  onChange,
  onSelect,
  selectedValue,
  onFocus,
  onBlur,
  placeholder,
  emptyMessage = 'Inga resultat',
  loadingMessage = 'Söker...',
  disabled = false,
  showClearButton = true,
  className = '',
}: SearchDropdownProps<T>) {
  // Internal state
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [serverResults, setServerResults] = useState<T[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Debounce the search query
  const updateDebouncedQuery = useDebounce((query: string) => {
    setDebouncedQuery(query)
  }, debounceMs)

  useEffect(() => {
    updateDebouncedQuery(value.trim())
  }, [value, updateDebouncedQuery])

  // Trigger server search when debounced query reaches threshold
  useEffect(() => {
    // Don't search if item is already selected
    if (selectedValue) {
      setServerResults([])
      return
    }

    // Don't search if below minimum length
    if (debouncedQuery.length < minSearchLength) {
      setServerResults([])
      return
    }

    const search = async () => {
      setIsSearching(true)
      try {
        const results = await searchFn(debouncedQuery)
        setServerResults(results)
      } catch (error) {
        console.error('SearchDropdown: Error fetching results', error)
        setServerResults([])
      } finally {
        setIsSearching(false)
      }
    }

    search()
  }, [debouncedQuery, selectedValue, minSearchLength, searchFn])

  // Combine pre-suggestions with server results
  const { allItems, preSuggestionsCount } = useMemo(() => {
    // Don't show anything if item is already selected
    if (selectedValue) {
      return { allItems: [], preSuggestionsCount: 0 }
    }

    const trimmed = value.trim()

    // Filter pre-suggestions based on search query
    const filteredPreSuggestions =
      trimmed.length === 0
        ? preSuggestions
        : preSuggestions.filter((item) => {
            const formatted = formatItem(item)
            const searchText = (
              formatted.searchableText || formatted.primaryText
            ).toLowerCase()
            return searchText.includes(trimmed.toLowerCase())
          })

    // If below min search length, only show pre-suggestions
    if (trimmed.length < minSearchLength) {
      return {
        allItems: filteredPreSuggestions,
        preSuggestionsCount: filteredPreSuggestions.length,
      }
    }

    // At or above min search length: combine pre-suggestions + server results
    // Deduplicate server results against pre-suggestions
    const preSuggestionKeys = new Set(filteredPreSuggestions.map(getKey))
    const uniqueServerResults = serverResults.filter(
      (item) => !preSuggestionKeys.has(getKey(item))
    )

    return {
      allItems: [...filteredPreSuggestions, ...uniqueServerResults],
      preSuggestionsCount: filteredPreSuggestions.length,
    }
  }, [
    value,
    selectedValue,
    preSuggestions,
    serverResults,
    minSearchLength,
    formatItem,
    getKey,
  ])

  // Format items for display
  const formattedItems = useMemo(() => {
    const preSuggestionKeys = new Set(preSuggestions.map(getKey))

    return allItems.map((item) => {
      const formatted = formatItem(item)
      const isPreSuggestion = preSuggestionKeys.has(getKey(item))

      // Append pre-suggestion label if applicable
      let secondaryText = formatted.secondaryText
      if (isPreSuggestion && preSuggestionLabel) {
        secondaryText = secondaryText
          ? `${secondaryText} · ${preSuggestionLabel}`
          : preSuggestionLabel
      }

      return {
        value: item,
        primaryText: formatted.primaryText,
        secondaryText,
      }
    })
  }, [allItems, preSuggestions, formatItem, getKey, preSuggestionLabel])

  // Determine if we should show the dropdown
  const shouldShowDropdown = useMemo(() => {
    if (!showDropdown || selectedValue) return false

    const trimmed = value.trim()

    // For pre-suggestions (< minSearchLength), only show if we have items
    if (trimmed.length < minSearchLength) {
      return formattedItems.length > 0
    }

    // For server search (>= minSearchLength), always show (for loading/empty states)
    return true
  }, [
    showDropdown,
    selectedValue,
    value,
    minSearchLength,
    formattedItems.length,
  ])

  // Event handlers
  const handleFocus = () => {
    setShowDropdown(true)
    onFocus?.()
  }

  const handleBlur = () => {
    // Delay to allow click events on dropdown items to fire first
    setTimeout(() => setShowDropdown(false), 200)
    onBlur?.()
  }

  const handleSelectItem = (item: T) => {
    onSelect(item)
    setShowDropdown(false)
    setServerResults([])
  }

  const handleClear = () => {
    onChange('')
    onSelect(null)
    setShowDropdown(false)
    setServerResults([])
  }

  // Split items into pre-suggestions and server results for rendering
  const hasPreSuggestions = preSuggestionsCount > 0
  const preSuggestionItems = hasPreSuggestions
    ? formattedItems.slice(0, preSuggestionsCount)
    : []
  const serverResultItems = hasPreSuggestions
    ? formattedItems.slice(preSuggestionsCount)
    : formattedItems

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {/* Clear button */}
        {showClearButton && selectedValue && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {shouldShowDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {/* Full loading state (no pre-suggestions) */}
          {isSearching && !hasPreSuggestions && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {loadingMessage}
            </div>
          )}

          {/* Empty state (no loading, no items) */}
          {!isSearching && formattedItems.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}

          {/* Results with pre-suggestions */}
          {hasPreSuggestions && (
            <div className="p-1">
              {/* Pre-suggestions (always shown) */}
              {preSuggestionItems.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm rounded-sm"
                  onClick={() => handleSelectItem(item.value)}
                >
                  <div className="font-medium">{item.primaryText}</div>
                  {item.secondaryText && (
                    <div className="text-xs text-muted-foreground">
                      {item.secondaryText}
                    </div>
                  )}
                </button>
              ))}

              {/* Loading for server results */}
              {isSearching && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {loadingMessage}
                </div>
              )}

              {/* Server results (when loaded) */}
              {!isSearching &&
                serverResultItems.length > 0 &&
                serverResultItems.map((item, index) => (
                  <button
                    key={preSuggestionsCount + index}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm rounded-sm"
                    onClick={() => handleSelectItem(item.value)}
                  >
                    <div className="font-medium">{item.primaryText}</div>
                    {item.secondaryText && (
                      <div className="text-xs text-muted-foreground">
                        {item.secondaryText}
                      </div>
                    )}
                  </button>
                ))}
            </div>
          )}

          {/* Results without pre-suggestions */}
          {!isSearching && !hasPreSuggestions && formattedItems.length > 0 && (
            <div className="p-1">
              {formattedItems.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm rounded-sm"
                  onClick={() => handleSelectItem(item.value)}
                >
                  <div className="font-medium">{item.primaryText}</div>
                  {item.secondaryText && (
                    <div className="text-xs text-muted-foreground">
                      {item.secondaryText}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
