import { Download } from 'lucide-react'

import { usePropertySearch } from '@/features/properties'
import {
  rentalBlockColumns,
  RentalBlockMobileCard,
  useBlockReasons,
  useRentalBlocksFilters,
} from '@/features/rental-blocks'

import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  DateRangeFilterDropdown,
  FilterBar,
  FilterDropdown,
  SearchFilterDropdown,
} from '@/shared/ui/filters'
import { ViewLayout } from '@/shared/ui/layout'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

const kategoriOptions = [
  'Bostad',
  'Bilplats',
  'Lokal',
  'Förråd',
  'Övrigt',
] as const

const distriktOptions = [
  'Distrikt Norr',
  'Distrikt Väst',
  'Distrikt Öst',
  'Distrikt Mitt',
  'Mimer Student',
] as const

export function RentalBlocksPage() {
  const { data: blockReasons } = useBlockReasons()
  const filters = useRentalBlocksFilters()
  const searchProperties = usePropertySearch()

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    const mainContent = document.querySelector('main')
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <ViewLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Spärrlista</h1>
        <p className="text-muted-foreground">
          Översikt av spärrar för bostäder i systemet
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Alla spärrar</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {filters.rentalBlocks.length} av {filters.meta?.totalRecords ?? 0}{' '}
              resultat
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={filters.handleExport}
              disabled={
                filters.isExporting || filters.rentalBlocks.length === 0
              }
            >
              <Download className="h-4 w-4 mr-2" />
              {filters.isExporting ? 'Exporterar...' : 'Exportera Excel'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <FilterBar
              searchValue={filters.searchInput}
              onSearchChange={filters.setSearchInput}
              searchPlaceholder="Sök på hyresobjekt, adress eller orsak..."
              hasActiveFilters={filters.hasActiveFilters}
              onClearFilters={filters.clearFilters}
            >
              <Select
                value={
                  filters.activeFilter === true
                    ? 'active'
                    : filters.activeFilter === false
                      ? 'expired'
                      : 'all'
                }
                onValueChange={(val) =>
                  filters.setActiveFilter(val as 'active' | 'expired' | 'all')
                }
              >
                <SelectTrigger className="w-[140px] font-semibold">
                  <SelectValue placeholder="Status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiva</SelectItem>
                  <SelectItem value="expired">Utgångna</SelectItem>
                  <SelectItem value="all">Alla</SelectItem>
                </SelectContent>
              </Select>

              <FilterDropdown
                options={kategoriOptions.map((o) => ({ label: o, value: o }))}
                selectedValue={filters.getFilterValue('kategori') || null}
                onSelectionChange={(val) =>
                  filters.setFilterValue('kategori', val)
                }
                placeholder="Kategori..."
              />

              <SearchFilterDropdown
                searchFn={searchProperties}
                selectedValue={filters.getFilterValue('fastighet') || null}
                onSelectionChange={(val) =>
                  filters.setFilterValue('fastighet', val)
                }
                placeholder="Fastighet..."
                searchPlaceholder="Sök fastighet..."
              />

              <FilterDropdown
                options={distriktOptions.map((o) => ({ label: o, value: o }))}
                selectedValue={filters.getFilterValue('distrikt') || null}
                onSelectionChange={(val) =>
                  filters.setFilterValue('distrikt', val)
                }
                placeholder="Distrikt..."
              />

              <FilterDropdown
                options={
                  blockReasons?.map((br) => ({
                    label: br.caption,
                    value: br.caption,
                  })) || []
                }
                selectedValue={filters.getFilterValue('orsak') || null}
                onSelectionChange={(val) =>
                  filters.setFilterValue('orsak', val)
                }
                placeholder="Orsak..."
                searchable
                searchPlaceholder="Sök orsak..."
              />

              <DateRangeFilterDropdown
                startDate={filters.getFilterValue('fromDate') || null}
                endDate={filters.getFilterValue('toDate') || null}
                onDateChange={(start, end) =>
                  filters.setDateRange('fromDate', 'toDate', start, end)
                }
                placeholder="Datum..."
              />
            </FilterBar>
          </div>

          {filters.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar spärrar...
            </div>
          ) : filters.error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av spärrar
            </div>
          ) : filters.rentalBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga spärrar hittades
            </div>
          ) : (
            <ResponsiveTable
              data={filters.rentalBlocks}
              columns={rentalBlockColumns}
              keyExtractor={(block) => block.id}
              mobileCardRenderer={(block) => (
                <RentalBlockMobileCard block={block} />
              )}
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
