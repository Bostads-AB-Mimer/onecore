import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v2/Collapsible'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v2/Badge'
import { ChevronDown } from 'lucide-react'
import { PropertySearch } from '@/features/properties/components/PropertySearch'
import { PropertyTypeFilters } from '@/features/properties/components/PropertyTypeFilters'
import { PropertyFilteredResults } from '@/features/properties/components/PropertyFilteredResults'
import { usePropertyFilters } from '@/features/properties/hooks/usePropertyFilters'

const SearchView = () => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const {
    searchQuery,
    setSearchQuery,
    searchTypeFilter,
    setSearchTypeFilter,
    filteredProperties,
    filteredSearchResults,
    showSearchResults,
    isFiltering,
  } = usePropertyFilters()

  return (
    <div className="py-4 animate-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Fastigheter</h1>
        <p className="text-muted-foreground">
          Översikt över alla fastigheter i systemet
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sök i fastighetsbasen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <PropertyTypeFilters
              searchTypeFilter={searchTypeFilter}
              setSearchTypeFilter={setSearchTypeFilter}
            />

            <div className="flex flex-col sm:flex-row gap-4">
              <PropertySearch
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </div>

            <Collapsible
              open={isFiltersOpen}
              onOpenChange={setIsFiltersOpen}
              className="border rounded-lg bg-muted/30 opacity-60"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex-1 justify-between px-0 hover:bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Filter</span>
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                        0
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isFiltersOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="px-4 pb-4">
                <div className="text-sm text-muted-foreground italic">
                  Kommer snart
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <PropertyFilteredResults
            showSearchResults={showSearchResults}
            filteredSearchResults={filteredSearchResults}
            filteredProperties={filteredProperties}
            searchTypeFilter={searchTypeFilter}
            activeFilterCount={0}
            isFiltering={isFiltering}
            filterChips={[]}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default SearchView
