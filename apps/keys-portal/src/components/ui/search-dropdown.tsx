import { ReactNode } from 'react'

export interface SearchDropdownItem<T = any> {
  value: T
  primaryText: string
  secondaryText?: string
  searchableText?: string // Text to filter against for pre-suggestions
}

interface SearchDropdownProps<T> {
  // Display state
  show: boolean
  isSearching: boolean

  // Data
  items: SearchDropdownItem<T>[]
  preSuggestionsCount?: number // Number of items at the top that are pre-suggestions

  // Callbacks
  onSelect: (value: T) => void

  // Customization
  emptyMessage?: string
  loadingMessage?: string
  className?: string
}

/**
 * Simple dropdown for search autocomplete.
 * Based on the working pattern from ContactAutocomplete.
 *
 * Shows a list of items with primary and secondary text.
 * Handles loading and empty states.
 */
export function SearchDropdown<T>({
  show,
  isSearching,
  items,
  preSuggestionsCount = 0,
  onSelect,
  emptyMessage = 'Inga resultat',
  loadingMessage = 'Söker...',
  className = '',
}: SearchDropdownProps<T>) {
  if (!show) return null

  const hasPreSuggestions = preSuggestionsCount > 0
  const preSuggestions = hasPreSuggestions
    ? items.slice(0, preSuggestionsCount)
    : []
  const serverResults = hasPreSuggestions
    ? items.slice(preSuggestionsCount)
    : items

  return (
    <div
      className={`absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto ${className}`}
    >
      {/* Full loading state (no pre-suggestions) */}
      {isSearching && !hasPreSuggestions && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {loadingMessage}
        </div>
      )}

      {/* Empty state (no loading, no items) */}
      {!isSearching && items.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}

      {/* Results with pre-suggestions */}
      {hasPreSuggestions && (
        <div className="p-1">
          {/* Pre-suggestions (always shown) */}
          {preSuggestions.map((item, index) => (
            <button
              key={index}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm rounded-sm"
              onClick={() => onSelect(item.value)}
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
            serverResults.length > 0 &&
            serverResults.map((item, index) => (
              <button
                key={preSuggestionsCount + index}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm rounded-sm"
                onClick={() => onSelect(item.value)}
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
      {!isSearching && !hasPreSuggestions && items.length > 0 && (
        <div className="p-1">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm rounded-sm"
              onClick={() => onSelect(item.value)}
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
  )
}
