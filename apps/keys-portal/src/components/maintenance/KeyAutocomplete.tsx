import { useCallback, useMemo, useState } from 'react'
import { keyService } from '@/services/api/keyService'
import { keySystemSearchService } from '@/services/api/keySystemSearchService'
import { SelectedKeyBadge } from '@/components/shared/SelectedKeyBadge'
import type { KeyDetails, KeySystem } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { SearchInput } from '@/components/shared/layout'
import { sortKeys } from '@/utils/sortKeys'
import { parseNumberFilter } from '@/utils/parseNumberFilter'
import { formatKeySystemLabel } from '@/utils/formatKeySystem'

interface KeyAutocompleteProps {
  selectedKeys: KeyDetails[]
  onAddKey: (key: KeyDetails) => void
  onRemoveKey: (keyId: string) => void
  disabled?: boolean
  existingKeyIds?: Set<string>
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
  existingKeyIds = new Set(),
}: KeyAutocompleteProps) {
  const [searchValue, setSearchValue] = useState('')
  const [keySequenceNumberInput, setKeySequenceNumberInput] = useState('')
  const [seqFieldFocused, setSeqFieldFocused] = useState(false)
  const [selectedKeySystem, setSelectedKeySystem] = useState<KeySystem | null>(
    null
  )
  const [keySystemSearch, setKeySystemSearch] = useState('')

  // Search function that filters out disposed keys and optionally filters by key system and sequence number
  const searchKeys = useCallback(
    async (query: string): Promise<KeyDetails[]> => {
      const seqFilter = parseNumberFilter(keySequenceNumberInput)
      const results = await keyService.searchKeys(
        {
          q: query,
          disposed: 'false',
          ...(selectedKeySystem?.id && { keySystemId: selectedKeySystem.id }),
          ...(seqFilter && { keySequenceNumber: seqFilter }),
        },
        1,
        60,
        // includeKeySystem: badges and result rows show the key system name
        true
      )
      return sortKeys(results.content)
    },
    [keySequenceNumberInput, selectedKeySystem?.id]
  )

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

  const handleSelect = (key: KeyDetails | null) => {
    if (key) {
      if (selectedKeyIds.has(key.id)) {
        onRemoveKey(key.id)
      } else {
        onAddKey(key)
      }
    }
  }

  const isKeyDisabled = (key: KeyDetails) => existingKeyIds.has(key.id)
  const isKeySelected = (key: KeyDetails) => selectedKeyIds.has(key.id)

  return (
    <div className="space-y-3">
      {/* Selected Keys Display */}
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedKeys.map((key) => (
            <SelectedKeyBadge
              key={key.id}
              selectedKey={key}
              onRemove={() => onRemoveKey(key.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Key System Filter, Key Search, and Sequence Number Filter */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: '2fr 3fr auto' }}
      >
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
            searchFn={searchKeys}
            minSearchLength={selectedKeySystem ? 0 : 2}
            debounceMs={300}
            formatItem={(key) => ({
              primaryText: key.keyName,
              secondaryText: [
                KeyTypeLabels[key.keyType],
                key.keySystem ? formatKeySystemLabel(key.keySystem) : null,
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
            emptyMessage="Inga nycklar hittades"
            loadingMessage="Söker nycklar..."
            disabled={disabled}
            showClearButton={false}
            multiSelect
            isItemDisabled={isKeyDisabled}
            isItemSelected={isKeySelected}
            open={seqFieldFocused}
          />
        </div>

        {/* Sequence Number Filter */}
        <div className="w-28">
          <label className="text-sm font-medium">Löpnr</label>
          <SearchInput
            value={keySequenceNumberInput}
            onChange={setKeySequenceNumberInput}
            placeholder="<50, 2-5"
            className="w-full"
            onFocus={() => setSeqFieldFocused(true)}
            onBlur={() => setSeqFieldFocused(false)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Sök på nyckelnamn (t.ex. "FS-001") eller hyresobjekt (t.ex. "705-011").
        Filtrera på löpnr med exakt nummer, intervall (10-100) eller jämförelse
        (&lt;50, &gt;100).
      </p>
    </div>
  )
}
