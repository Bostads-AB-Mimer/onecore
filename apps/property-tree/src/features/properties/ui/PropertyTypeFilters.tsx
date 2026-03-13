import { Building, CarFront, Home, Warehouse, Wrench } from 'lucide-react'

import { FilterChip } from '@/shared/ui/filters'

type SearchTypeFilter =
  | 'property'
  | 'residence'
  | 'parking-space'
  | 'facility'
  | 'maintenance-unit'

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
        selected={searchTypeFilter === 'residence'}
        onSelect={() => setSearchTypeFilter('residence')}
      >
        <Home className="h-4 w-4" />
        <span>Lägenheter</span>
      </FilterChip>
      <FilterChip
        selected={searchTypeFilter === 'parking-space'}
        onSelect={() => setSearchTypeFilter('parking-space')}
      >
        <CarFront className="h-4 w-4" />
        <span>Parkeringar</span>
      </FilterChip>
      <FilterChip
        selected={searchTypeFilter === 'facility'}
        onSelect={() => setSearchTypeFilter('facility')}
      >
        <Warehouse className="h-4 w-4" />
        <span>Lokaler</span>
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
