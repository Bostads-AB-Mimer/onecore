import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { ObjectTypeBadge, DistriktBadge } from '@/components/ui/StatusBadges'
import {
  SearchFilterDropdown,
  SearchFilterOption,
} from '@/components/ui/SearchFilterDropdown'
import { DateRangeFilterDropdown } from '@/components/ui/DateRangeFilterDropdown'
import { useAllRentalBlocks } from '@/components/hooks/useRentalBlocks'
import { useBlockReasons } from '@/components/hooks/useBlockReasons'
import { useUrlPagination } from '@/components/hooks/useUrlPagination'
import { useDebounce } from '@/components/hooks/useDebounce'
import { Pagination } from '@/components/ui/Pagination'
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

const formatISODate = (isoDateString: string | null | undefined) => {
  if (!isoDateString) return '-'
  const date = new Date(isoDateString)
  return date.toLocaleDateString('sv-SE')
}

const PAGE_SIZE = 50

const RentalBlocksPage = () => {
  const [isExporting, setIsExporting] = useState(false)
  const { data: blockReasons } = useBlockReasons()

  const { page, setPage, searchParams, updateUrlParams } = useUrlPagination({
    defaultLimit: PAGE_SIZE,
  })

  // Read filters from URL params
  // 'active' filter: true = active blocks, false = expired blocks, undefined = all blocks
  const activeFilter = useMemo(() => {
    const val = searchParams.get('active')
    if (val === 'true') return true
    if (val === 'false') return false
    if (val === 'all') return undefined
    // Default to showing active blocks (toDate >= today or toDate is null)
    return true
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
  const setActiveFilter = (val: 'active' | 'expired' | 'all') => {
    // active → active: true (default, so omit from URL)
    // expired → active: false
    // all → active: 'all' (special case for showing all)
    updateUrlParams({
      active:
        val === 'active' ? undefined : val === 'expired' ? 'false' : 'all',
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

  // Map active filter to API parameter
  // activeFilter is already boolean | undefined from the useMemo

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
      active: activeFilter,
    },
    page,
    PAGE_SIZE
  )

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / PAGE_SIZE)
    : 1

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
        active: activeFilter,
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
      active: undefined,
      kategori: undefined,
      fastighet: undefined,
      distrikt: undefined,
      orsak: undefined,
      fromDate: undefined,
      toDate: undefined,
      page: undefined,
    })
  }

  // Check if any filters are active (not default values)
  const hasActiveFilters =
    debouncedSearch ||
    activeFilter !== true || // Default is active=true
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
                value={
                  activeFilter === true
                    ? 'active'
                    : activeFilter === false
                      ? 'expired'
                      : 'all'
                }
                onValueChange={(val) =>
                  setActiveFilter(val as 'active' | 'expired' | 'all')
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
                options={
                  blockReasons?.map((br) => ({
                    label: br.caption,
                    value: br.caption,
                  })) || []
                }
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

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
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
              columns={[
                {
                  key: 'hyresobjekt',
                  label: 'Hyresobjekt',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) => {
                    const displayText =
                      block.rentalObject?.rentalId ||
                      block.rentalObject?.code ||
                      '-'
                    const category = block.rentalObject?.category
                    const rentalId = block.rentalObject?.rentalId
                    const residenceId = block.rentalObject?.residenceId

                    // Determine link based on category
                    let href: string | null = null
                    if (category === 'Bostad' && residenceId) {
                      href = `/residences/${residenceId}`
                    } else if (category === 'Bilplats' && rentalId) {
                      href = `/parking-spaces/${rentalId}`
                    } else if (
                      (category === 'Lokal' || category === 'Förråd') &&
                      rentalId
                    ) {
                      href = `/facilities/${rentalId}`
                    }

                    if (href) {
                      return (
                        <Link to={href} className="font-medium hover:underline">
                          {displayText}
                        </Link>
                      )
                    }

                    return <span className="font-medium">{displayText}</span>
                  },
                },
                {
                  key: 'kategori',
                  label: 'Kategori',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) => (
                    <ObjectTypeBadge
                      type={block.rentalObject?.category ?? null}
                    />
                  ),
                  hideOnMobile: true,
                },
                {
                  key: 'typ',
                  label: 'Typ',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.rentalObject?.type || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'adress',
                  label: 'Adress',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.rentalObject?.address || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'fastighet',
                  label: 'Fastighet',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.property?.name || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'distrikt',
                  label: 'Distrikt',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) => (
                    <DistriktBadge distrikt={block.distrikt ?? null} />
                  ),
                  hideOnMobile: true,
                },
                {
                  key: 'orsak',
                  label: 'Orsak',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.blockReason,
                },
                {
                  key: 'startdatum',
                  label: 'Startdatum',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    formatISODate(block.fromDate),
                  hideOnMobile: true,
                },
                {
                  key: 'slutdatum',
                  label: 'Slutdatum',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.toDate ? formatISODate(block.toDate) : '-',
                  hideOnMobile: true,
                },
                {
                  key: 'hyra',
                  label: 'Årshyra',
                  className: 'px-2',
                  render: (block: RentalBlockWithRentalObject) =>
                    block.rentalObject?.yearlyRent
                      ? `${Math.round(block.rentalObject.yearlyRent).toLocaleString('sv-SE')} kr/år`
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
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {block.rentalObject?.category || '-'}
                    </span>
                  </div>
                </div>
              )}
            />
          )}

          <Pagination
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
