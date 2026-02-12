import { useEffect, useRef } from 'react'
import { Search, User, Home, Car, Building } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { UnifiedSearchResult } from '@/services/api/unifiedSearchService'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  loading?: boolean
  placeholder?: string
  title?: string
  description?: string
  helpText?: React.ReactNode
  // Dropdown props
  dropdownResults: UnifiedSearchResult[]
  showDropdown: boolean
  isSearching: boolean
  selectedIndex: number
  onSelectResult: (result: UnifiedSearchResult) => void
  onMouseEnterResult: (index: number) => void
  onCloseDropdown: () => void
}

function getResultBadge(result: UnifiedSearchResult) {
  switch (result.type) {
    case 'residence':
      return { label: 'LGH', color: 'bg-blue-100 text-blue-700', Icon: Home }
    case 'parking-space':
      return { label: 'P', color: 'bg-amber-100 text-amber-700', Icon: Car }
    case 'facility':
      return {
        label: 'Lokal',
        color: 'bg-purple-100 text-purple-700',
        Icon: Building,
      }
    case 'contact':
      return {
        label: 'Kontakt',
        color: 'bg-green-100 text-green-700',
        Icon: User,
      }
  }
}

function getResultDisplay(result: UnifiedSearchResult) {
  if (result.type === 'contact') {
    const isCompany = result.data.contactCode?.toUpperCase().startsWith('F')
    return {
      primary: result.data.fullName ?? 'Okänt namn',
      secondary: `${result.data.contactCode} ${isCompany ? '• Företag' : '• Person'}`,
    }
  }

  return {
    primary: result.data.rentalId ?? 'Okänt ID',
    secondary: result.data.name ?? '',
  }
}

/**
 * Search input component with dropdown suggestions for the KeyLoan page.
 * Supports search-as-you-type dropdown and exact match on Enter.
 */
export function SearchInput({
  value,
  onChange,
  onSearch,
  onKeyDown,
  loading = false,
  placeholder = 'Sök...',
  title = 'Sök',
  description,
  helpText,
  dropdownResults,
  showDropdown,
  isSearching,
  selectedIndex,
  onSelectResult,
  onMouseEnterResult,
  onCloseDropdown,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        onCloseDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCloseDropdown])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => {
                if (dropdownResults.length > 0) {
                  onCloseDropdown()
                  // Re-open on next tick so the effect can pick it up
                }
              }}
              className="flex-1"
            />
            <Button onClick={onSearch} className="gap-2" disabled={loading}>
              <Search className="h-4 w-4" />
              {loading ? 'Söker…' : 'Sök'}
            </Button>
          </div>

          {/* Dropdown suggestions */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[400px] overflow-y-auto"
            >
              {isSearching && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Söker...
                </div>
              )}

              {!isSearching && value.trim().length < 3 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Skriv minst 3 tecken för att söka
                </div>
              )}

              {!isSearching &&
                value.trim().length >= 3 &&
                dropdownResults.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Inga resultat hittades
                  </div>
                )}

              {!isSearching && dropdownResults.length > 0 && (
                <div className="p-1">
                  {dropdownResults.map((result, index) => {
                    const badge = getResultBadge(result)
                    const display = getResultDisplay(result)
                    const key =
                      result.type === 'contact'
                        ? `contact-${result.data.contactCode}`
                        : `${result.type}-${result.data.rentalId}-${result.data.id}`

                    return (
                      <div
                        key={key}
                        className={`px-3 py-2 cursor-pointer rounded-sm transition-colors ${
                          index === selectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onClick={() => onSelectResult(result)}
                        onMouseEnter={() => onMouseEnterResult(index)}
                      >
                        <div className="flex items-center gap-2">
                          <badge.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">
                            {display.primary}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        {display.secondary && (
                          <div className="text-xs text-muted-foreground ml-6">
                            {display.secondary}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {helpText && (
          <div className="text-sm text-muted-foreground space-y-1">
            {helpText}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
