import { useRef } from 'react'

import {
  leaseColumns,
  LeaseMobileCard,
  useLeaseFilters,
} from '@/features/leases'
import { usePropertySearch } from '@/features/properties'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  DateRangeFilterDropdown,
  FilterBar,
  MultiSelectFilterDropdown,
  MultiSelectSearchFilterDropdown,
} from '@/shared/ui/filters'
import { ViewLayout } from '@/shared/ui/layout'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

const objectTypeOptions = [
  { label: 'Bostad', value: 'bostad' },
  { label: 'Parkering', value: 'parkering' },
  { label: 'Lokal', value: 'lokal' },
  { label: 'Övrigt', value: 'ovrigt' },
] as const

const statusOptions = [
  { label: 'Gällande', value: '0' },
  { label: 'Kommande', value: '1' },
  { label: 'Uppsagd', value: '2' },
  { label: 'Upphört', value: '3' },
] as const

const districtOptions = [
  'Distrikt Norr',
  'Distrikt Väst',
  'Distrikt Öst',
  'Distrikt Mitt',
  'Mimer Student',
] as const

const LeasesPage = () => {
  const cardRef = useRef<HTMLDivElement>(null)
  const filters = useLeaseFilters()
  const searchProperties = usePropertySearch()

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    cardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <ViewLayout>
      <h1 className="text-3xl font-bold">Hyreskontrakt</h1>
      <p className="text-muted-foreground">
        Sök och filtrera hyreskontrakt i systemet
      </p>

      <Card ref={cardRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hyreskontrakt</CardTitle>
          <span className="text-sm text-muted-foreground">
            {filters.leases.length} av {filters.meta?.totalRecords ?? 0}{' '}
            resultat
          </span>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <FilterBar
              searchValue={filters.searchInput}
              onSearchChange={filters.setSearchInput}
              searchPlaceholder="Sök på kontraktsnummer, hyresgäst, personnummer, adress..."
              hasActiveFilters={filters.hasActiveFilters}
              onClearFilters={filters.clearFilters}
            >
              <MultiSelectFilterDropdown
                options={objectTypeOptions.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
                selectedValues={filters.selectedObjectTypes}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('objectType', vals)
                }
                placeholder="Objekttyp"
              />

              <MultiSelectFilterDropdown
                options={statusOptions.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
                selectedValues={filters.selectedStatuses}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('status', vals)
                }
                placeholder="Status"
              />

              <MultiSelectSearchFilterDropdown
                searchFn={searchProperties}
                selectedValues={filters.selectedProperties}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('property', vals)
                }
                placeholder="Fastighet"
                searchPlaceholder="Sök fastighet"
              />

              <MultiSelectFilterDropdown
                options={districtOptions.map((o) => ({ label: o, value: o }))}
                selectedValues={filters.selectedDistricts}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('district', vals)
                }
                placeholder="Distrikt"
              />

              <MultiSelectSearchFilterDropdown
                searchFn={filters.searchBuildingManagers}
                minSearchLength={0}
                selectedValues={filters.selectedBuildingManagers}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('buildingManager', vals)
                }
                placeholder="Kvartersvärd"
                searchPlaceholder="Sök kvartersvärd"
              />

              <DateRangeFilterDropdown
                startDate={filters.startDateFrom || null}
                endDate={filters.startDateTo || null}
                onDateChange={(start, end) =>
                  filters.setDateRange(
                    'startDateFrom',
                    'startDateTo',
                    start,
                    end
                  )
                }
                placeholder="Startdatum"
              />

              <DateRangeFilterDropdown
                startDate={filters.endDateFrom || null}
                endDate={filters.endDateTo || null}
                onDateChange={(start, end) =>
                  filters.setDateRange('endDateFrom', 'endDateTo', start, end)
                }
                placeholder="Slutdatum"
              />
            </FilterBar>
          </div>

          {filters.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar hyreskontrakt...
            </div>
          ) : filters.error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av hyreskontrakt
            </div>
          ) : filters.leases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga hyreskontrakt hittades
            </div>
          ) : (
            <ResponsiveTable
              data={filters.leases}
              columns={leaseColumns}
              keyExtractor={(lease) => lease.leaseId}
              mobileCardRenderer={LeaseMobileCard}
            />
          )}

          <Pagination
            currentPage={filters.page}
            totalPages={filters.totalPages}
            totalRecords={filters.meta?.totalRecords ?? 0}
            pageSize={filters.pageSize}
            onPageChange={handlePageChange}
            isFetching={filters.isFetching}
          />
        </CardContent>
      </Card>
    </ViewLayout>
  )
}

export default LeasesPage
