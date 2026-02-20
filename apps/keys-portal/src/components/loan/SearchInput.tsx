import { useCallback } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { searchAll } from '@/services/api/unifiedSearchService'
import type { UnifiedSearchResult } from '@/services/api/unifiedSearchService'
import {
  getRentalSearchDisplay,
  getContactSearchDisplay,
} from '@/components/shared/SearchBadges'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  onSelect: (result: UnifiedSearchResult) => void
  loading?: boolean
  placeholder?: string
  title?: string
  description?: string
  helpText?: React.ReactNode
}

function formatResult(result: UnifiedSearchResult) {
  if (result.type === 'contact') {
    const isCompany = result.data.contactCode?.toUpperCase().startsWith('F')
    return {
      primaryText: result.data.fullName ?? 'Okänt namn',
      secondaryText: `${result.data.contactCode} ${isCompany ? '· Företag' : '· Person'}`,
      searchableText: `${result.data.fullName} ${result.data.contactCode} ${result.data.nationalRegistrationNumber}`,
      ...getContactSearchDisplay(),
    }
  }

  return {
    primaryText: result.data.rentalId,
    secondaryText: result.data.name,
    searchableText: `${result.data.rentalId} ${result.data.name}`,
    ...getRentalSearchDisplay(result.data.type),
  }
}

function getResultKey(result: UnifiedSearchResult) {
  if (result.type === 'contact') return `contact-${result.data.contactCode}`
  return `rental-${result.data.rentalId}`
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  onSelect,
  loading = false,
  placeholder = 'Sök...',
  title = 'Sök',
  description,
  helpText,
}: SearchInputProps) {
  const handleSelect = useCallback(
    (result: UnifiedSearchResult | null) => {
      if (result) onSelect(result)
    },
    [onSelect]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onSearch()
      }
    },
    [onSearch]
  )

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
        <div className="flex gap-2">
          <SearchDropdown<UnifiedSearchResult>
            preSuggestions={[]}
            searchFn={searchAll}
            minSearchLength={3}
            debounceMs={300}
            formatItem={formatResult}
            getKey={getResultKey}
            value={value}
            onChange={onChange}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
            selectedValue={null}
            placeholder={placeholder}
            emptyMessage="Inga resultat hittades"
            loadingMessage="Söker..."
            showClearButton={false}
            showSelectedInInput={false}
            showSearchIcon
            className="flex-1"
          />
          <Button onClick={onSearch} className="gap-2" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Söker…' : 'Sök'}
          </Button>
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
