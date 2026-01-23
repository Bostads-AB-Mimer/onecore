import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Download } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Input } from '@/components/ui/Input'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Badge } from '@/components/ui/v3/Badge'
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
import { useAllRentalBlocks } from '@/components/hooks/useRentalBlocks'
import { useUrlPagination } from '@/components/hooks/useUrlPagination'
import { useDebounce } from '@/components/hooks/useDebounce'
import { RentalBlocksPagination } from './RentalBlocksPagination'
import { residenceService } from '@/services/api/core/residenceService'
import { propertyService } from '@/services/api/core/propertyService'
import type { RentalBlockWithRentalObject } from '@/services/types'

// Category options matching backend enum
const kategoriOptions = [
  'Bostad',
  'Bilplats',
  'Lokal',
  'Förråd',
  'Övrigt',
] as const

// Hardcoded district options
const distriktOptions = [
  'Distrikt Norr',
  'Distrikt Väst',
  'Distrikt Öst',
  'Distrikt Mitt',
  'Mimer Student',
] as const

// Hardcoded block reason options
const orsakOptions = [
  'ÄNDRAT INFLYTTNINGSDATUM',
  'ANNULLERAT OBJEKT',
  'ANVÄNDS EJ - EJ GODKÄND ....',
  'ANVÄNDS EJ - SPÄRRAD',
  'ANVÄNDS EJ STÄNGT PROJ 86371',
  'ANVÄNDS EJ STÄNGT PROJ 86420',
  'ANVÄNDS EJ STÄNGT PROJ 86430',
  'AVHYSNING',
  'BLOCKAVTAL',
  'BRANDSKADA',
  'BRANDSKADA, 86510 VÄLLJÄRNET 3, 12701',
  'DIREKTFLYTT OMBYGGATION',
  'EJ BESIKTNINGSBAR',
  'EJ KLART FÖR UTHYRNING',
  'EJ VISNINGSBAR - ÅTGÄRDER BESTÄLLDA',
  'ESKALERAD BESIKTNING',
  'EVAKUERING, BILPLATS',
  'EVAKUERING, LGH',
  'INGÅR I ANNAT OBJEKT',
  'INVÄNTAR BESIKTNING',
  'INVÄNTAR SVAR FRÅN KVARTERSVÄRD',
  'LÄGENHET TILL SAMVERKANSAVTAL',
  'OMBESIKTNING',
  'P-PLATS - ALLMÄN HANDIKAPPS',
  'P-PLATS - BESÖKSPARKERING',
  'P-PLATS - CENTRUMPARKERING',
  'PROJ 86370 EVAK.LGH KOLAREN 1',
  'PROJ 86380 EVAK.LGH BERGATROLLET 1',
  'PROJ 86450 EVAK.LGH STENRIKET 5',
  'REPARATION, RENOVERAS EFTER INFLYTT, LGH',
  'REPARATION, RENOVERAS INNAN INFLYTT, LGH',
  'ROTRENOVERING -DISTRIKT',
  'ROTRENOVERING VAKANTA LGH',
  'SÅLD',
  'SERVITUT',
  'SKA SÄLJAS',
  'SKA STYCKERENOVERAS - STYCKRENOVERING',
  'SKADEDJUR',
  'SMITNING',
  'UPPDATERA OBJEKT',
  'VATTENSKADA',
  'VLU TILL FLU',
  'VLU TILL FLU KONTROLL EKONOMI',
] as const

const formatISODate = (isoDateString: string | null | undefined) => {
  if (!isoDateString) return '-'
  const date = new Date(isoDateString)
  return date.toLocaleDateString('sv-SE')
}

const PAGE_SIZE = 50

const RentalBlocksPage = () => {
  const [isExporting, setIsExporting] = useState(false)

  const { page, setPage, searchParams, updateUrlParams } = useUrlPagination({
    defaultLimit: PAGE_SIZE,
  })

  // Read filters from URL params
  const statusFilter = useMemo(() => {
    const val = searchParams.get('status')
    return val === 'active' || val === 'expired' || val === 'all'
      ? val
      : 'active'
  }, [searchParams])

  const selectedKategori = useMemo(
    () => searchParams.get('kategori') || '',
    [searchParams]
  )
  const selectedFastighet = useMemo(
    () => searchParams.get('fastighet') || '',
    [searchParams]
  )
  const selectedDistrikt = useMemo(
    () => searchParams.get('distrikt') || '',
    [searchParams]
  )
  const selectedOrsak = useMemo(
    () => searchParams.get('orsak') || '',
    [searchParams]
  )
  const startDatum = useMemo(
    () => searchParams.get('fromDate') || '',
    [searchParams]
  )
  const slutDatum = useMemo(
    () => searchParams.get('toDate') || '',
    [searchParams]
  )

  // Search input with debounce for URL sync
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )
  const debouncedSearch = useDebounce(searchInput, 300)

  // Sync debounced search to URL
  useEffect(() => {
    const currentSearch = searchParams.get('search') || ''
    if (debouncedSearch !== currentSearch) {
      updateUrlParams(
        { search: debouncedSearch || undefined, page: undefined },
        { replace: true }
      )
    }
  }, [debouncedSearch, searchParams, updateUrlParams])

  // Sync URL back to input (for browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== searchInput) {
      setSearchInput(urlSearch)
    }
  }, [searchParams])

  // Filter update handlers
  const setStatusFilter = (val: 'active' | 'expired' | 'all') => {
    updateUrlParams({
      status: val === 'active' ? undefined : val,
      page: undefined,
    })
  }

  const setSelectedKategori = (val: string | null) => {
    updateUrlParams({ kategori: val || undefined, page: undefined })
  }

  const setSelectedFastighet = (val: string | null) => {
    updateUrlParams({ fastighet: val || undefined, page: undefined })
  }

  const setSelectedDistrikt = (val: string | null) => {
    updateUrlParams({ distrikt: val || undefined, page: undefined })
  }

  const setSelectedOrsak = (val: string | null) => {
    updateUrlParams({ orsak: val || undefined, page: undefined })
  }

  const setDateRange = (start: string | null, end: string | null) => {
    updateUrlParams({
      fromDate: start || undefined,
      toDate: end || undefined,
      page: undefined,
    })
  }

  // Map status filter to API parameter
  // 'active' → active: true, 'expired' → active: false, 'all' → active: undefined
  const active =
    statusFilter === 'active'
      ? true
      : statusFilter === 'expired'
        ? false
        : undefined

  const {
    data: rentalBlocks,
    meta,
    isLoading,
    isFetching,
    error,
  } = useAllRentalBlocks(
    {
      q: debouncedSearch || undefined,
      kategori: selectedKategori || undefined,
      distrikt: selectedDistrikt || undefined,
      blockReason: selectedOrsak || undefined,
      fastighet: selectedFastighet || undefined,
      fromDateGte: startDatum || undefined,
      toDateLte: slutDatum || undefined,
      active,
    },
    page,
    PAGE_SIZE
  )

  const totalPages = meta ? Math.ceil(meta.totalRecords / PAGE_SIZE) : 1

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    // Scroll the main content container (SidebarInset) to top
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
      const blob = await residenceService.exportRentalBlocksToExcel({
        q: debouncedSearch || undefined,
        kategori: selectedKategori || undefined,
        distrikt: selectedDistrikt || undefined,
        blockReason: selectedOrsak || undefined,
        fastighet: selectedFastighet || undefined,
        fromDateGte: startDatum || undefined,
        toDateLte: slutDatum || undefined,
        active,
      })

      // Trigger download
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

  // Search function for property filter
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

  const clearFilters = () => {
    setSearchInput('')
    updateUrlParams({
      search: undefined,
      status: undefined,
      kategori: undefined,
      fastighet: undefined,
      distrikt: undefined,
      orsak: undefined,
      fromDate: undefined,
      toDate: undefined,
      page: undefined,
    })
  }

  // Check if any filters are active
  const hasActiveFilters =
    debouncedSearch ||
    statusFilter !== 'active' ||
    selectedKategori ||
    selectedFastighet ||
    selectedDistrikt ||
    selectedOrsak ||
    startDatum ||
    slutDatum

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
            {/* Search input with icon */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på hyresobjekt, adress eller orsak..."
                className="pl-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) =>
                  setStatusFilter(val as 'active' | 'expired' | 'all')
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
                selectedValue={selectedKategori || null}
                onSelectionChange={setSelectedKategori}
                placeholder="Kategori..."
              />

              <SearchFilterDropdown
                searchFn={searchProperties}
                selectedValue={selectedFastighet || null}
                onSelectionChange={setSelectedFastighet}
                placeholder="Fastighet..."
                searchPlaceholder="Sök fastighet..."
              />

              <FilterDropdown
                options={distriktOptions.map((o) => ({ label: o, value: o }))}
                selectedValue={selectedDistrikt || null}
                onSelectionChange={setSelectedDistrikt}
                placeholder="Distrikt..."
              />

              <FilterDropdown
                options={orsakOptions.map((o) => ({ label: o, value: o }))}
                selectedValue={selectedOrsak || null}
                onSelectionChange={setSelectedOrsak}
                placeholder="Orsak..."
                searchable
                searchPlaceholder="Sök orsak..."
              />

              <DateRangeFilterDropdown
                startDate={startDatum || null}
                endDate={slutDatum || null}
                onDateChange={setDateRange}
                placeholder="Datum..."
              />
            </div>

            {/* Clear all filters button */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Rensa alla filter
                </Button>
              </div>
            )}
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
              columns={[
                {
                  key: 'hyresobjekt',
                  label: 'Hyresobjekt',
                  render: (block: RentalBlockWithRentalObject) => (
                    <span className="font-medium">
                      {block.rentalObject?.rentalId ||
                        block.rentalObject?.code ||
                        '-'}
                    </span>
                  ),
                },
                {
                  key: 'kategori',
                  label: 'Kategori',
                  render: (block: RentalBlockWithRentalObject) => (
                    <Badge variant="secondary">
                      {block.rentalObject?.category || '-'}
                    </Badge>
                  ),
                  hideOnMobile: true,
                },
                {
                  key: 'typ',
                  label: 'Typ',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.rentalObject?.type || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'adress',
                  label: 'Adress',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.rentalObject?.address || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'fastighet',
                  label: 'Fastighet',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.property?.name || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'distrikt',
                  label: 'Distrikt',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.distrikt || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'orsak',
                  label: 'Orsak',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.blockReason,
                },
                {
                  key: 'startdatum',
                  label: 'Startdatum',
                  render: (block: RentalBlockWithRentalObject) =>
                    formatISODate(block.fromDate),
                  hideOnMobile: true,
                },
                {
                  key: 'slutdatum',
                  label: 'Slutdatum',
                  render: (block: RentalBlockWithRentalObject) =>
                    formatISODate(block.toDate),
                  hideOnMobile: true,
                },
                {
                  key: 'hyra',
                  label: 'Hyra',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.rentalObject?.monthlyRent
                      ? `${Math.round(block.rentalObject.monthlyRent).toLocaleString('sv-SE')} kr/mån`
                      : '-',
                  hideOnMobile: true,
                },
                {
                  key: 'hyresbortfall',
                  label: 'Estimerat Hyresbortfall',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.amount
                      ? `${block.amount.toLocaleString('sv-SE')} kr`
                      : '-',
                  hideOnMobile: true,
                },
              ]}
              keyExtractor={(block) => block.id}
              mobileCardRenderer={(block: RentalBlockWithRentalObject) => (
                <div className="space-y-2 w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {block.rentalObject?.rentalId ||
                          block.rentalObject?.code ||
                          '-'}
                      </span>
                      <div className="text-sm text-muted-foreground">
                        {block.property?.name || '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {block.distrikt || '-'}
                      </div>
                      <div className="text-sm">{block.blockReason}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatISODate(block.fromDate)} -{' '}
                        {formatISODate(block.toDate)}
                      </div>
                      {block.amount && (
                        <div className="text-sm">
                          Hyresbortfall: {block.amount.toLocaleString('sv-SE')}{' '}
                          kr
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {block.rentalObject?.category || '-'}
                    </Badge>
                  </div>
                </div>
              )}
            />
          )}

          <RentalBlocksPagination
            currentPage={page}
            totalPages={totalPages}
            totalRecords={meta?.totalRecords ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            isFetching={isFetching}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default RentalBlocksPage
