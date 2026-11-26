import { useEffect, useRef, useState } from 'react'
import { Check, Filter, Loader2, X } from 'lucide-react'

import { useDebounce } from '@/shared/hooks/useDebounce'
import { useSelectedOptionLabels } from '@/shared/hooks/useSelectedOptionLabels'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

export interface SearchFilterOption {
  label: string
  value: string
  description?: string
}

interface MultiSelectSearchFilterDropdownProps {
  /** Function to search for options (called with debounced query) */
  searchFn: (query: string) => Promise<SearchFilterOption[]>
  /** Minimum characters before search is triggered */
  minSearchLength?: number
  /** Currently selected values */
  selectedValues: string[]
  /** Called when selection changes */
  onSelectionChange: (values: string[]) => void
  /** Placeholder text for the button */
  placeholder?: string
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Message shown when no results */
  emptyMessage?: string
  /** Debounce delay in ms */
  debounceMs?: number
  /**
   * Looks up labels for selected values that have none yet (e.g. from a
   * saved link). Returns options only for values it finds. Callers must pass
   * a stable function. Without it, a selected value is shown as is.
   */
  resolveLabels?: (values: string[]) => Promise<SearchFilterOption[]>
  className?: string
}

/**
 * A multi-select filter dropdown with search functionality.
 * Searches via API when user types, allows multiple selections.
 */
export function MultiSelectSearchFilterDropdown({
  searchFn,
  minSearchLength = 3,
  selectedValues,
  onSelectionChange,
  placeholder = 'Filter',
  searchPlaceholder = 'Sök...',
  emptyMessage = 'Inga resultat',
  debounceMs = 300,
  className,
  resolveLabels,
}: MultiSelectSearchFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<SearchFilterOption[]>([])
  // Query the current results (or error) came from
  const [resultsQuery, setResultsQuery] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const { getDisplayLabel, remember, forget, clear } = useSelectedOptionLabels(
    selectedValues,
    resolveLabels
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebounce(searchInput, debounceMs)
  const hasActiveFilter = selectedValues.length > 0

  // Search when dropdown opens or debounced value changes
  useEffect(() => {
    // A cancelled search must not leave the spinner or an old error behind
    if (!open) {
      setIsSearching(false)
      setSearchError(false)
      return
    }
    if (debouncedSearch.length < minSearchLength) {
      setResults([])
      setResultsQuery(null)
      setIsSearching(false)
      setSearchError(false)
      return
    }

    // Set by cleanup so a response for an older query or after unmount is dropped
    let ignore = false

    const search = async () => {
      setIsSearching(true)
      setSearchError(false)
      try {
        const searchResults = await searchFn(debouncedSearch)
        if (ignore) return
        setResults(searchResults)
        setResultsQuery(debouncedSearch)
      } catch (err: unknown) {
        console.error('MultiSelectSearchFilterDropdown: Search failed', err)
        if (ignore) return
        setResults([])
        setResultsQuery(debouncedSearch)
        setSearchError(true)
      } finally {
        if (!ignore) setIsSearching(false)
      }
    }

    search()

    return () => {
      ignore = true
    }
  }, [open, debouncedSearch, minSearchLength, searchFn])

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearchInput('')
      setResults([])
      setResultsQuery(null)
      setSearchError(false)
    }
  }, [open])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const handleToggle = (option: SearchFilterOption) => {
    const isSelected = selectedValues.includes(option.value)
    if (isSelected) {
      handleRemoveSelected(option.value)
    } else {
      onSelectionChange([...selectedValues, option.value])
      remember(option.value, option.label)
    }
  }

  const handleRemoveSelected = (value: string) => {
    onSelectionChange(selectedValues.filter((v) => v !== value))
    forget(value)
  }

  const handleClear = () => {
    onSelectionChange([])
    clear()
  }

  const showResults = debouncedSearch.length >= minSearchLength
  // Results (or error) belong to the text now in the field
  const resultsAreCurrent = resultsQuery === searchInput
  const showSpinner = isSearching || (showResults && !resultsAreCurrent)
  const showCurrent = showResults && resultsAreCurrent && !isSearching

  // Get button text
  const getButtonText = () => {
    if (selectedValues.length === 0) return placeholder
    if (selectedValues.length === 1) {
      return getDisplayLabel(selectedValues[0])
    }
    return `${placeholder} +${selectedValues.length}`
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className={cn(
          'h-9 min-w-[130px] px-3 font-semibold justify-between',
          hasActiveFilter && 'text-primary border-primary'
        )}
      >
        <span className="truncate max-w-[150px]">{getButtonText()}</span>
        <Filter
          className={cn(
            'h-3 w-3 ml-2 shrink-0',
            hasActiveFilter && 'fill-current'
          )}
        />
      </Button>

      {/* Dropdown content */}
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border bg-popover p-2 shadow-md">
          {/* Search input */}
          <div className="relative">
            <Input
              ref={inputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 text-sm pr-8"
            />
            {showSpinner && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Selected items */}
          {hasActiveFilter && (
            <div className="mt-2 pb-2 border-b space-y-0.5">
              {selectedValues.map((value) => (
                <div
                  key={value}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-sm bg-accent rounded-sm"
                >
                  <span className="truncate">{getDisplayLabel(value)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSelected(value)}
                    className="ml-2 hover:bg-primary/20 rounded-sm p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="mt-2 max-h-48 overflow-y-auto">
            {!showResults && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Skriv minst {minSearchLength} tecken för att söka
              </div>
            )}

            {showCurrent && searchError && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Sökningen misslyckades. Försök igen.
              </div>
            )}

            {showCurrent && !searchError && results.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            )}

            {showResults && resultsAreCurrent && results.length > 0 && (
              <div className="space-y-0.5">
                {results.map((option) => {
                  const isSelected = selectedValues.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent flex items-center gap-2',
                        isSelected && 'bg-accent'
                      )}
                      onClick={() => handleToggle(option)}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center',
                          isSelected ? 'text-primary' : 'text-transparent'
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col text-left">
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Clear button */}
          {hasActiveFilter && (
            <>
              <div className="border-t my-2" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 justify-start px-2 text-xs"
                onClick={handleClear}
              >
                <X className="h-3 w-3 mr-1" />
                Rensa filter
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
