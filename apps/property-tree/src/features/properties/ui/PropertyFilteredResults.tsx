import { Building } from 'lucide-react'

import type { Property } from '@/services/types'

import { EmptyState } from '@/shared/ui/EmptyState'
import { RemovableChip } from '@/shared/ui/filters'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { SearchTypeFilter } from '../hooks/usePropertyFilters'
import type { SearchResult } from '../types'
import { PropertiesTable } from './PropertiesTable'
import { SearchResultsTable } from './SearchResultsTable'

interface FilterChip {
  label: string
  value: string
  onRemove: () => void
}

interface PropertyFilteredResultsProps {
  showSearchResults: boolean
  filteredSearchResults: SearchResult[]
  filteredProperties: Property[]
  /** 'rental-object' renders its own results view, not this one. */
  searchTypeFilter: Exclude<SearchTypeFilter, 'rental-object'>
  activeFilterCount?: number
  isFiltering?: boolean
  filterChips?: FilterChip[]
}

export const PropertyFilteredResults = ({
  showSearchResults,
  filteredSearchResults,
  filteredProperties,
  searchTypeFilter,
  activeFilterCount = 0,
  isFiltering = false,
  filterChips = [],
}: PropertyFilteredResultsProps) => {
  const contentTypeMap = {
    property: 'Fastigheter',
    'maintenance-unit': 'Underhållsenheter',
  } as const
  const contentType = contentTypeMap[searchTypeFilter]

  // Show loading state
  if (isFiltering) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const hasResults = showSearchResults
    ? filteredSearchResults.length > 0
    : filteredProperties.length > 0

  return (
    <>
      {/* Filter Chips */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filterChips.map((chip, index) => (
            <RemovableChip key={index} onRemove={chip.onRemove}>
              {chip.label}: {chip.value}
            </RemovableChip>
          ))}
        </div>
      )}

      {!hasResults ? (
        <EmptyState
          icon={Building}
          title="Inga resultat hittades"
          description={
            activeFilterCount > 0
              ? 'Försök att justera dina filter för att hitta vad du söker.'
              : 'Det finns inga fastigheter att visa.'
          }
        />
      ) : showSearchResults ? (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{contentType}</h2>
            <p className="text-sm text-muted-foreground">
              Visar {filteredSearchResults.length} resultat
              {activeFilterCount > 0 && (
                <span className="ml-1">
                  med {activeFilterCount}{' '}
                  {activeFilterCount === 1 ? 'filter' : 'filter'}
                </span>
              )}
            </p>
          </div>
          <SearchResultsTable results={filteredSearchResults} />
        </>
      ) : (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Fastigheter</h2>
            <p className="text-sm text-muted-foreground">
              Visar {filteredProperties.length} fastigheter
              {activeFilterCount > 0 && (
                <span className="ml-1">
                  med {activeFilterCount}{' '}
                  {activeFilterCount === 1 ? 'filter' : 'filter'}
                </span>
              )}
            </p>
          </div>
          <PropertiesTable properties={filteredProperties} />
        </>
      )}
    </>
  )
}
