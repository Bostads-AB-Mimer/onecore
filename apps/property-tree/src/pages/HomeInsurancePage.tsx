import { useRef } from 'react'
import { Download, Loader2 } from 'lucide-react'

import {
  homeInsuranceActionColumn,
  homeInsuranceColumns,
  HomeInsuranceMobileCard,
  type HomeInsuranceView,
  LF_STATUS_OPTIONS,
  parseHomeInsuranceView,
  useHomeInsuranceFilters,
} from '@/features/home-insurance'

import { HOME_INSURANCE_WRITE_ROLE, useHasRole } from '@/entities/user'

import { isCacheWarmingError, listFailure } from '@/services/api/core/baseApi'

import { personnummerSearchHint } from '@/shared/lib/personnummerSearchHint'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { FilterBar, MultiSelectFilterDropdown } from '@/shared/ui/filters'
import { ViewLayout } from '@/shared/ui/layout'
import { ListQueryState } from '@/shared/ui/ListQueryState'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

const views: { value: HomeInsuranceView; label: string }[] = [
  { value: 'lf', label: 'LF-urval' },
  { value: 'all', label: 'Alla rader' },
  { value: 'same-date', label: 'Samma datum' },
]

export function HomeInsurancePage() {
  const cardRef = useRef<HTMLDivElement>(null)
  const filters = useHomeInsuranceFilters()
  const canWrite = useHasRole(HOME_INSURANCE_WRITE_ROLE)

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    cardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <ViewLayout>
      <h1 className="text-3xl font-bold">Hemförsäkringar</h1>
      <p className="text-muted-foreground">
        Hemförsäkringar på hyreskontrakten, med samma urval som filen till
        Länsförsäkringar
      </p>

      <Card ref={cardRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hemförsäkringar</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {filters.rows.length} av {filters.totalRecords} resultat
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => filters.exportToExcel()}
              disabled={filters.isExporting || filters.totalRecords === 0}
            >
              {filters.isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporterar...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportera Excel
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={filters.view}
            onValueChange={(value) =>
              filters.setView(parseHomeInsuranceView(value))
            }
            className="mb-4"
          >
            <TabsList>
              {views.map((v) => (
                <TabsTrigger key={v.value} value={v.value}>
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mb-6">
            <FilterBar
              searchValue={filters.searchInput}
              onSearchChange={filters.setSearchInput}
              searchPlaceholder="Sök på kontraktsnummer, objektnummer, kundnummer, personnummer, adress..."
              hasActiveFilters={filters.hasActiveFilters}
              onClearFilters={filters.clearFilters}
              hint={personnummerSearchHint(filters.searchInput)}
            >
              <MultiSelectFilterDropdown
                options={LF_STATUS_OPTIONS}
                selectedValues={filters.selectedStatuses}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('status', vals)
                }
                placeholder="LF-status"
              />
            </FilterBar>
          </div>

          <ListQueryState
            subject="hemförsäkringar"
            isWarming={
              !filters.error && isCacheWarmingError(filters.failureReason)
            }
            isLoading={filters.isLoading}
            isFetching={filters.isFetching}
            failure={filters.error ? listFailure(filters.error) : undefined}
            isEmpty={filters.rows.length === 0}
          >
            <ResponsiveTable
              data={filters.rows}
              columns={
                canWrite
                  ? [...homeInsuranceColumns, homeInsuranceActionColumn]
                  : homeInsuranceColumns
              }
              keyExtractor={(row) => row.rowId}
              mobileCardRenderer={HomeInsuranceMobileCard}
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSort={filters.handleSort}
            />
          </ListQueryState>

          <Pagination
            currentPage={filters.page}
            totalPages={filters.totalPages}
            totalRecords={filters.totalRecords}
            pageSize={filters.pageSize}
            onPageChange={handlePageChange}
            isFetching={filters.isFetching}
          />
        </CardContent>
      </Card>
    </ViewLayout>
  )
}
