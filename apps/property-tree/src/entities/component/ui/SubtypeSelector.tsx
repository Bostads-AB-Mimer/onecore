import { useState } from 'react'

import type { ComponentSubtype } from '@/services/types'

import { useDebounce } from '@/shared/hooks/useDebounce'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'

import { useComponentEntity } from '../hooks/useComponentEntity'
import { formatSubtypePath } from '../lib/subtypePath'

const MIN_SEARCH_LENGTH = 2

interface SubtypeSelectorProps {
  value: ComponentSubtype | undefined
  onChange: (subtype: ComponentSubtype) => void
  error?: string
}

export const SubtypeSelector = ({
  value,
  onChange,
  error,
}: SubtypeSelectorProps) => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim(), 300)
  const shouldSearch = debouncedSearch.length >= MIN_SEARCH_LENGTH

  const {
    data: subtypes = [],
    isLoading,
    error: subtypesError,
  } = useComponentEntity(
    'subtype',
    undefined,
    { search: shouldSearch ? debouncedSearch : undefined },
    { enabled: shouldSearch }
  )

  return (
    <div className="space-y-2">
      <Label htmlFor="subtype-search">Undertyp</Label>
      <Input
        id="subtype-search"
        type="search"
        placeholder="Sök undertyp, t.ex. Kylskåp"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-describedby={error ? 'subtype-search-error' : undefined}
      />

      <div className="border rounded-md max-h-60 overflow-y-auto">
        {subtypesError ? (
          <p className="p-4 text-center text-sm text-destructive">
            Kunde inte ladda undertyper
          </p>
        ) : !shouldSearch ? (
          <p className="p-4 text-center text-muted-foreground text-sm">
            Skriv minst {MIN_SEARCH_LENGTH} tecken för att söka
          </p>
        ) : isLoading ? (
          <div className="p-4">
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        ) : subtypes.length === 0 ? (
          <p className="p-4 text-center text-muted-foreground text-sm">
            Inga undertyper hittades
          </p>
        ) : (
          <ul className="divide-y">
            {subtypes.map((subtype) => (
              <li key={subtype.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(subtype)
                    setSearch('')
                  }}
                  aria-pressed={value?.id === subtype.id}
                  className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${
                    value?.id === subtype.id ? 'bg-accent' : ''
                  }`}
                >
                  <span className="block text-sm font-medium">
                    {subtype.subTypeName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatSubtypePath(subtype)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value && (
        <div className="p-3 bg-accent rounded-md">
          <p className="text-sm font-medium">Vald undertyp:</p>
          <p className="text-sm text-muted-foreground">
            {[formatSubtypePath(value), value.subTypeName]
              .filter(Boolean)
              .join(' / ')}
          </p>
        </div>
      )}

      {error && (
        <p id="subtype-search-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
