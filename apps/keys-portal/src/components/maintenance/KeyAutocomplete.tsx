import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { keyService } from '@/services/api/keyService'
import { keySystemSearchService } from '@/services/api/keySystemSearchService'
import { Badge } from '@/components/ui/badge'
import type { Key, KeySystem } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { SearchDropdown } from '@/components/ui/search-dropdown'

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
  const [selectedKeySystem, setSelectedKeySystem] = useState<KeySystem | null>(
    null
  )
  const [keySystemSearch, setKeySystemSearch] = useState('')

  // Search function that filters out disposed keys and optionally filters by key system
  const searchKeys = async (query: string): Promise<Key[]> => {
    const results = await keyService.searchKeys({
      q: query,
      disposed: 'false',
      ...(selectedKeySystem?.id && { keySystemId: selectedKeySystem.id }),
    })
    return results.content
  }

  // Search function for key systems
  const searchKeySystems = async (query: string): Promise<KeySystem[]> => {
    return await keySystemSearchService.search({
      q: query,
      fields: ['systemCode', 'name'],
    })
  }

  // Filter out already selected keys from search results
  const selectedKeyIds = useMemo(
    () => new Set(selectedKeys.map((k) => k.id)),
    [selectedKeys]
  )

  // Wrap search function to filter out selected keys
  const searchKeysFiltered = async (query: string): Promise<Key[]> => {
    const results = await searchKeys(query)
    return results.filter((key) => !selectedKeyIds.has(key.id))
  }

  const handleSelect = (key: Key | null) => {
    if (key) {
      onAddKey(key)
      setSearchValue('') // Clear search after selection
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

      {/* Key System Filter and Key Search - Side by Side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Key System Filter */}
        <div>
          <label className="text-sm font-medium">Låssystem</label>
          <SearchDropdown
            preSuggestions={[]}
            searchFn={searchKeySystems}
            minSearchLength={1}
            formatItem={(item: KeySystem) => ({
              primaryText: item.systemCode,
              secondaryText: item.name || undefined,
              searchableText: `${item.systemCode} ${item.name || ''}`,
            })}
            getKey={(item: KeySystem) => item.id}
            value={keySystemSearch}
            onChange={setKeySystemSearch}
            onSelect={setSelectedKeySystem}
            selectedValue={selectedKeySystem}
            placeholder="Filtrera på låssystem..."
            disabled={disabled}
          />
        </div>

        {/* Key Search */}
        <div>
          <label className="text-sm font-medium">Sök nyckel</label>
          <SearchDropdown
            preSuggestions={[]}
            searchFn={searchKeysFiltered}
            minSearchLength={3}
            debounceMs={300}
            formatItem={(key) => ({
              primaryText: key.keyName,
              secondaryText: [
                KeyTypeLabels[key.keyType],
                key.rentalObjectCode,
                key.keySequenceNumber
                  ? `Löpnr: ${key.keySequenceNumber}`
                  : null,
                key.flexNumber ? `Flex: ${key.flexNumber}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
              searchableText: `${key.keyName} ${key.rentalObjectCode || ''} ${key.keySequenceNumber || ''} ${key.flexNumber || ''}`,
            })}
            getKey={(key) => key.id}
            value={searchValue}
            onChange={setSearchValue}
            onSelect={handleSelect}
            selectedValue={null}
            placeholder="Sök nyckelnamn eller hyresobjekt..."
            emptyMessage={
              selectedKeyIds.size > 0
                ? 'Alla hittade nycklar är redan valda'
                : 'Inga nycklar hittades'
            }
            loadingMessage="Söker nycklar..."
            disabled={disabled}
            showClearButton={false}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Sök på nyckelnamn (t.ex. "FS-001") eller hyresobjekt (t.ex. "705-011")
      </p>
    </div>
  )
}
