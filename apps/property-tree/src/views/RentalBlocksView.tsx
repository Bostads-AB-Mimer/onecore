import { useCallback, useState } from 'react'
import { Search, Download } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Input } from '@/components/ui/Input'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { FilterDropdown } from '@/components/ui/FilterDropdown'
import {
  SearchFilterDropdown,
  SearchFilterOption,
} from '@/components/ui/SearchFilterDropdown'
import { DateRangeFilterDropdown } from '@/components/ui/DateRangeFilterDropdown'
import {
  useBlockReasons,
  useRentalBlocks,
  useRentalBlocksFilters,
  rentalBlockColumns,
  RentalBlockMobileCard,
} from '@/features/rental-blocks'
import { Pagination } from '@/components/ui/Pagination'
import { residenceService } from '@/services/api/core/residenceService'
import { propertyService } from '@/services/api/core/propertyService'

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

const RentalBlocksView = () => {
  const [isExporting, setIsExporting] = useState(false)
  const { data: blockReasons } = useBlockReasons()
  const filters = useRentalBlocksFilters()

  const {
    data: rentalBlocks,
    meta,
    isLoading,
    isFetching,
    error,
  } = useRentalBlocks(filters.params, filters.page, filters.pageSize)

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / filters.pageSize)
    : 1

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    const mainContent = document.querySelector('main')
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleExport = async () => {
    if (!meta?.totalRecords || meta.totalRecords === 0) return

    setIsExporting(true)
    try {
      const blob = await residenceService.exportRentalBlocksToExcel(
        filters.params
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sparrlista-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const searchProperties = useCallback(
    async (query: string): Promise<SearchFilterOption[]> => {
      const results = await propertyService.searchProperties(query)
      return results.map((p) => ({
        label: p.designation,
        value: p.designation,
      }))
    },
    []
  )

  const displayBlocks = rentalBlocks || []

  return (
    <div className="py-4 animate-in">
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
              {displayBlocks.length} av {meta?.totalRecords ?? 0} resultat
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || displayBlocks.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporterar...' : 'Exportera Excel'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på hyresobjekt, adress eller orsak..."
                className="pl-10"
                value={filters.searchInput}
                onChange={(e) => filters.setSearchInput(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
                selectedValue={filters.selectedKategori || null}
                onSelectionChange={filters.setSelectedKategori}
                placeholder="Kategori..."
              />

              <SearchFilterDropdown
                searchFn={searchProperties}
                selectedValue={filters.selectedFastighet || null}
                onSelectionChange={filters.setSelectedFastighet}
                placeholder="Fastighet..."
                searchPlaceholder="Sök fastighet..."
              />

              <FilterDropdown
                options={distriktOptions.map((o) => ({ label: o, value: o }))}
                selectedValue={filters.selectedDistrikt || null}
                onSelectionChange={filters.setSelectedDistrikt}
                placeholder="Distrikt..."
              />

              <FilterDropdown
                options={
                  blockReasons?.map((br) => ({
                    label: br.caption,
                    value: br.caption,
                  })) || []
                }
                selectedValue={filters.selectedOrsak || null}
                onSelectionChange={filters.setSelectedOrsak}
                placeholder="Orsak..."
                searchable
                searchPlaceholder="Sök orsak..."
              />

              <DateRangeFilterDropdown
                startDate={filters.startDatum || null}
                endDate={filters.slutDatum || null}
                onDateChange={filters.setDateRange}
                placeholder="Datum..."
              />

              {filters.hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={filters.clearFilters}
                >
                  Rensa alla filter
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar spärrar...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av spärrar
            </div>
          ) : displayBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga spärrar hittades
            </div>
          ) : (
            <ResponsiveTable
              data={displayBlocks}
              columns={rentalBlockColumns}
              keyExtractor={(block) => block.id}
              mobileCardRenderer={(block) => (
                <RentalBlockMobileCard block={block} />
              )}
            />
          )}

          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            totalRecords={meta?.totalRecords ?? 0}
            pageSize={filters.pageSize}
            onPageChange={handlePageChange}
            isFetching={isFetching}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default RentalBlocksView
