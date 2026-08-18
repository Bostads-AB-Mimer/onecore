import { Building, Home, Wrench } from 'lucide-react'

import { FilterChip } from '@/shared/ui/filters'

import type { SearchTypeFilter } from '../hooks/usePropertyFilters'

interface PropertyTypeFiltersProps {
  searchTypeFilter: SearchTypeFilter
  setSearchTypeFilter: (value: SearchTypeFilter) => void
}

export const PropertyTypeFilters = ({
  searchTypeFilter,
  setSearchTypeFilter,
}: PropertyTypeFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        selected={searchTypeFilter === 'property'}
        onSelect={() => setSearchTypeFilter('property')}
      >
        <Building className="h-4 w-4" />
        <span>Fastigheter</span>
      </FilterChip>
      <FilterChip
        selected={searchTypeFilter === 'rental-object'}
        onSelect={() => setSearchTypeFilter('rental-object')}
      >
        <Home className="h-4 w-4" />
        <span>Hyresobjekt</span>
      </FilterChip>
      <FilterChip
        selected={searchTypeFilter === 'maintenance-unit'}
        onSelect={() => setSearchTypeFilter('maintenance-unit')}
      >
        <Wrench className="h-4 w-4" />
        <span>Underhållsenheter</span>
      </FilterChip>
    </div>
  )
}
