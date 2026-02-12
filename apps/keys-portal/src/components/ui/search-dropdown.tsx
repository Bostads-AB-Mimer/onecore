import { useState, useEffect, useMemo, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Check, Search } from 'lucide-react'
import { useDebounce } from '@/utils/debounce'

export interface SearchDropdownDisplayFormat {
  primaryText: string
  secondaryText?: string
  searchableText?: string // For client-side filtering, defaults to primaryText
  icon?: React.ReactNode // Icon displayed before the primary text (e.g. lucide icon)
  badge?: React.ReactNode // Badge displayed after the primary text (e.g. <Badge>)
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

  // Focus/Blur/Keyboard
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void

  // UI Customization
  placeholder?: string
  emptyMessage?: string // Default: "Inga resultat"
  loadingMessage?: string // Default: "Söker..."
  disabled?: boolean
  showClearButton?: boolean // Default: true when selectedValue exists
  className?: string
  showSelectedInInput?: boolean // Show selected value's text in input (default: true)
  multiSelect?: boolean // Keep dropdown open after selecting an item
  isItemDisabled?: (item: T) => boolean // Grey out and prevent selection
  isItemSelected?: (item: T) => boolean // Show checkmark on item
  showSearchIcon?: boolean // Show a magnifying glass icon in the input
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
  onKeyDown,
  placeholder,
  emptyMessage = 'Inga resultat',
  loadingMessage = 'Söker...',
  disabled = false,
  showClearButton = true,
  className = '',
  showSelectedInInput = true,
  multiSelect = false,
  isItemDisabled,
  isItemSelected,
  showSearchIcon = false,
}: SearchDropdownProps<T>) {
  // Internal state
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [serverResults, setServerResults] = useState<T[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Stable refs for callback props used in effects/memos — prevents parent
  // re-renders from triggering re-fetches or memo recalculations.
  // Note: isItemDisabled/isItemSelected are NOT ref'd since they affect render output.
  const searchFnRef = useRef(searchFn)
  const formatItemRef = useRef(formatItem)
  const getKeyRef = useRef(getKey)
  useEffect(() => {
    searchFnRef.current = searchFn
    formatItemRef.current = formatItem
    getKeyRef.current = getKey
  })

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
        const results = await searchFnRef.current(debouncedQuery)
        setServerResults(results)
      } catch (error) {
        console.error('SearchDropdown: Error fetching results', error)
        setServerResults([])
      } finally {
        setIsSearching(false)
      }
    }

    search()
  }, [debouncedQuery, selectedValue, minSearchLength])

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
            const formatted = formatItemRef.current(item)
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
    const preSuggestionKeys = new Set(
      filteredPreSuggestions.map(getKeyRef.current)
    )
    const uniqueServerResults = serverResults.filter(
      (item) => !preSuggestionKeys.has(getKeyRef.current(item))
    )

    return {
      allItems: [...filteredPreSuggestions, ...uniqueServerResults],
      preSuggestionsCount: filteredPreSuggestions.length,
    }
  }, [value, selectedValue, preSuggestions, serverResults, minSearchLength])

  // Format items for display
  const formattedItems = useMemo(() => {
    const preSuggestionKeys = new Set(preSuggestions.map(getKeyRef.current))

    return allItems.map((item) => {
      const formatted = formatItemRef.current(item)
      const isPreSuggestion = preSuggestionKeys.has(getKeyRef.current(item))

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
        icon: formatted.icon,
        badge: formatted.badge,
      }
    })
  }, [allItems, preSuggestions, preSuggestionLabel])

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
    if (isItemDisabled?.(item)) return
    onSelect(item)
    if (!multiSelect) {
      setShowDropdown(false)
      setServerResults([])
    }
  }

  const handleClear = () => {
    onChange('')
    onSelect(null)
    setShowDropdown(false)
    setServerResults([])
  }

  const renderItem = (
    item: {
      value: T
      primaryText: string
      secondaryText?: string
      icon?: React.ReactNode
      badge?: React.ReactNode
    },
    index: number
  ) => {
    const itemDisabled = isItemDisabled?.(item.value) ?? false
    const itemSelected = isItemSelected?.(item.value) ?? false

    return (
      <button
        key={index}
        type="button"
        className={`w-full text-left px-3 py-2 text-sm rounded-sm flex items-center justify-between gap-2 ${
          itemDisabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-accent cursor-pointer'
        }`}
        onClick={() => handleSelectItem(item.value)}
        disabled={itemDisabled}
      >
        <div className="flex items-center gap-2 min-w-0">
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.primaryText}</span>
              {item.badge && <span className="shrink-0">{item.badge}</span>}
            </div>
            {item.secondaryText && (
              <div className="text-xs text-muted-foreground">
                {item.secondaryText}
              </div>
            )}
          </div>
        </div>
        {itemSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </button>
    )
  }

  // Split items into pre-suggestions and server results for rendering
  const hasPreSuggestions = preSuggestionsCount > 0
  const preSuggestionItems = hasPreSuggestions
    ? formattedItems.slice(0, preSuggestionsCount)
    : []
  const serverResultItems = hasPreSuggestions
    ? formattedItems.slice(preSuggestionsCount)
    : formattedItems

  // Get display value for the input
  const displayValue = useMemo(() => {
    if (selectedValue && showSelectedInInput) {
      const formatted = formatItemRef.current(selectedValue)
      // Show both primary and secondary text if available
      return formatted.secondaryText
        ? `${formatted.primaryText} - ${formatted.secondaryText}`
        : formatted.primaryText
    }
    return value
  }, [selectedValue, showSelectedInInput, value])

  // Determine if filter is active (has selection)
  const isFilterActive = !!selectedValue

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        {showSearchIcon && (
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`${showSearchIcon ? 'pl-8' : ''} ${
            isFilterActive
              ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
              : ''
          }`}
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
        <div
          className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
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
              {preSuggestionItems.map((item, index) => renderItem(item, index))}

              {isSearching && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {loadingMessage}
                </div>
              )}

              {!isSearching &&
                serverResultItems.length > 0 &&
                serverResultItems.map((item, index) =>
                  renderItem(item, preSuggestionsCount + index)
                )}
            </div>
          )}

          {/* Results without pre-suggestions */}
          {!isSearching && !hasPreSuggestions && formattedItems.length > 0 && (
            <div className="p-1">
              {formattedItems.map((item, index) => renderItem(item, index))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
