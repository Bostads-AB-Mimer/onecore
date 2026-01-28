import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Filter, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/components/hooks/useDebounce'

export interface SearchFilterOption {
  label: string
  value: string
}

interface SearchFilterDropdownProps {
  /** Function to search for options (called with debounced query) */
  searchFn: (query: string) => Promise<SearchFilterOption[]>
  /** Minimum characters before search is triggered */
  minSearchLength?: number
  /** Currently selected value */
  selectedValue: string | null
  /** Called when selection changes */
  onSelectionChange: (value: string | null) => void
  /** Placeholder text for the button */
  placeholder?: string
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Message shown when no results */
  emptyMessage?: string
  /** Debounce delay in ms */
  debounceMs?: number
  className?: string
}

/**
 * A filter dropdown with search functionality.
 * Searches via API when user types, then allows selection.
 */
export function SearchFilterDropdown({
  searchFn,
  minSearchLength = 3,
  selectedValue,
  onSelectionChange,
  placeholder = 'Filter...',
  searchPlaceholder = 'Sök...',
  emptyMessage = 'Inga resultat',
  debounceMs = 300,
  className,
}: SearchFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<SearchFilterOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebounce(searchInput, debounceMs)
  const hasActiveFilter = selectedValue !== null

  // Search when debounced value changes
  useEffect(() => {
    if (debouncedSearch.length < minSearchLength) {
      setResults([])
      return
    }

    const search = async () => {
      setIsSearching(true)
      try {
        const searchResults = await searchFn(debouncedSearch)
        setResults(searchResults)
      } catch (error) {
        console.error('SearchFilterDropdown: Search failed', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    search()
  }, [debouncedSearch, minSearchLength, searchFn])

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearchInput('')
      setResults([])
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

  const handleSelect = (option: SearchFilterOption) => {
    onSelectionChange(option.value)
    setOpen(false)
  }

  const handleClear = () => {
    onSelectionChange(null)
    setOpen(false)
  }

  const showResults = debouncedSearch.length >= minSearchLength

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
        <span className="truncate">{selectedValue || placeholder}</span>
        <Filter
          className={cn(
            'h-3 w-3 ml-2 shrink-0',
            hasActiveFilter && 'fill-current'
          )}
        />
      </Button>

      {/* Dropdown content */}
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover p-2 shadow-md">
          {/* Search input */}
          <div className="relative">
            <Input
              ref={inputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 text-sm pr-8"
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Results */}
          <div className="mt-2 max-h-48 overflow-y-auto">
            {!showResults && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Skriv minst {minSearchLength} tecken för att söka
              </div>
            )}

            {showResults && !isSearching && results.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            )}

            {showResults && results.length > 0 && (
              <div className="space-y-0.5">
                {results.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent',
                      selectedValue === option.value && 'bg-accent'
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    {option.label}
                  </button>
                ))}
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
