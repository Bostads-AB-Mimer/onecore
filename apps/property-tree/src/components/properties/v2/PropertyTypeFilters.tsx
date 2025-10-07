import { Building, Home } from 'lucide-react'
import { FilterChip } from '@/components/ui/v2/FilterChip'

type SearchTypeFilter = 'property' | 'residence'

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
    </div>
  )
}
