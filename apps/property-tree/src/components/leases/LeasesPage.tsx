import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { MultiSelectFilterDropdown } from '@/components/ui/MultiSelectFilterDropdown'
import {
  MultiSelectSearchFilterDropdown,
  SearchFilterOption,
} from '@/components/ui/MultiSelectSearchFilterDropdown'
import { DateRangeFilterDropdown } from '@/components/ui/DateRangeFilterDropdown'
import {
  useLeaseSearch,
  type LeaseSearchResult,
} from '@/components/hooks/useLeaseSearch'
import { useUrlPagination } from '@/components/hooks/useUrlPagination'
import { useDebounce } from '@/components/hooks/useDebounce'
import { Pagination } from '@/components/ui/Pagination'
import { propertyService } from '@/services/api/core/propertyService'
import {
  leaseSearchService,
  type BuildingManager,
} from '@/services/api/core/leaseSearchService'
import { LeaseStatusBadge, ObjectTypeBadge } from '@/components/ui/StatusBadges'

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

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('sv-SE')
}

const PAGE_SIZE = 50

const LeasesPage = () => {
  const [isExporting, setIsExporting] = useState(false)
  const { page, setPage, searchParams, setSearchParams, updateUrlParams } =
    useUrlPagination({
      defaultLimit: PAGE_SIZE,
    })

  // Read filters from URL params
  const selectedObjectTypes = useMemo(
    () => searchParams.getAll('objectType'),
    [searchParams]
  )
  const selectedStatuses = useMemo(
    () => searchParams.getAll('status') as ('0' | '1' | '2' | '3')[],
    [searchParams]
  )
  const selectedProperties = useMemo(
    () => searchParams.getAll('property'),
    [searchParams]
  )
  const selectedDistricts = useMemo(
    () => searchParams.getAll('district'),
    [searchParams]
  )
  const selectedBuildingManagers = useMemo(
    () => searchParams.getAll('buildingManager'),
    [searchParams]
  )
  const startDateFrom = useMemo(
    () => searchParams.get('startDateFrom') || '',
    [searchParams]
  )
  const startDateTo = useMemo(
    () => searchParams.get('startDateTo') || '',
    [searchParams]
  )
  const endDateFrom = useMemo(
    () => searchParams.get('endDateFrom') || '',
    [searchParams]
  )
  const endDateTo = useMemo(
    () => searchParams.get('endDateTo') || '',
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
  const setSelectedObjectTypes = (vals: string[]) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('objectType')
    vals.forEach((v) => newParams.append('objectType', v))
    newParams.delete('page')
    setSearchParams(newParams)
  }

  const setSelectedStatuses = (vals: string[]) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('status')
    vals.forEach((v) => newParams.append('status', v))
    newParams.delete('page')
    setSearchParams(newParams)
  }

  const setSelectedProperties = (vals: string[]) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('property')
    vals.forEach((v) => newParams.append('property', v))
    newParams.delete('page')
    setSearchParams(newParams)
  }

  const setSelectedDistricts = (vals: string[]) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('district')
    vals.forEach((v) => newParams.append('district', v))
    newParams.delete('page')
    setSearchParams(newParams)
  }

  const setSelectedBuildingManagers = (vals: string[]) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('buildingManager')
    vals.forEach((v) => newParams.append('buildingManager', v))
    newParams.delete('page')
    setSearchParams(newParams)
  }

  const setStartDateRange = (start: string | null, end: string | null) => {
    updateUrlParams({
      startDateFrom: start || undefined,
      startDateTo: end || undefined,
      page: undefined,
    })
  }

  const setEndDateRange = (start: string | null, end: string | null) => {
    updateUrlParams({
      endDateFrom: start || undefined,
      endDateTo: end || undefined,
      page: undefined,
    })
  }

  const {
    data: leases,
    meta,
    isLoading,
    isFetching,
    error,
    exportToExcel,
  } = useLeaseSearch(
    {
      q: debouncedSearch || undefined,
      objectType:
        selectedObjectTypes.length > 0 ? selectedObjectTypes : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      property: selectedProperties.length > 0 ? selectedProperties : undefined,
      districtNames:
        selectedDistricts.length > 0 ? selectedDistricts : undefined,
      buildingManager:
        selectedBuildingManagers.length > 0
          ? selectedBuildingManagers
          : undefined,
      startDateFrom: startDateFrom || undefined,
      startDateTo: startDateTo || undefined,
      endDateFrom: endDateFrom || undefined,
      endDateTo: endDateTo || undefined,
    },
    page,
    PAGE_SIZE
  )

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / PAGE_SIZE)
    : 1

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
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
      const blob = await exportToExcel({
        q: debouncedSearch || undefined,
        objectType:
          selectedObjectTypes.length > 0 ? selectedObjectTypes : undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        property:
          selectedProperties.length > 0 ? selectedProperties : undefined,
        districtNames:
          selectedDistricts.length > 0 ? selectedDistricts : undefined,
        startDateFrom: startDateFrom || undefined,
        startDateTo: startDateTo || undefined,
        endDateFrom: endDateFrom || undefined,
        endDateTo: endDateTo || undefined,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hyreskontrakt-${new Date().toISOString().split('T')[0]}.xlsx`
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

  // Building manager filter: fetch once, filter client-side
  const buildingManagersRef = useRef<BuildingManager[] | null>(null)
  const searchBuildingManagers = useCallback(
    async (query: string): Promise<SearchFilterOption[]> => {
      if (!buildingManagersRef.current) {
        buildingManagersRef.current =
          await leaseSearchService.getBuildingManagers()
      }

      const q = query.toLowerCase()
      return buildingManagersRef.current
        .filter(
          (bm: BuildingManager) =>
            bm.name.toLowerCase().includes(q) ||
            bm.district.toLowerCase().includes(q)
        )
        .map((bm: BuildingManager) => ({
          label: `${bm.name} (${bm.code})`,
          value: bm.name,
          description: bm.district,
        }))
    },
    []
  )

  const displayLeases = leases || []

  const clearFilters = () => {
    setSearchInput('')
    updateUrlParams({
      search: undefined,
      objectType: undefined,
      status: undefined,
      property: undefined,
      district: undefined,
      buildingManager: undefined,
      startDateFrom: undefined,
      startDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      page: undefined,
    })
  }

  const hasActiveFilters =
    debouncedSearch ||
    selectedObjectTypes.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedProperties.length > 0 ||
    selectedDistricts.length > 0 ||
    selectedBuildingManagers.length > 0 ||
    startDateFrom ||
    startDateTo ||
    endDateFrom ||
    endDateTo

  return (
    <div className="py-4 animate-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Hyreskontrakt</h1>
        <p className="text-muted-foreground">
          Sök och filtrera hyreskontrakt i systemet
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hyreskontrakt</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {displayLeases.length} av {meta?.totalRecords ?? 0} resultat
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || (meta?.totalRecords ?? 0) === 0}
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
                placeholder="Sök på kontraktsnummer, hyresgäst, personnummer, adress..."
                className="pl-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-2">
              <MultiSelectFilterDropdown
                options={objectTypeOptions.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
                selectedValues={selectedObjectTypes}
                onSelectionChange={setSelectedObjectTypes}
                placeholder="Objekttyp"
              />

              <MultiSelectFilterDropdown
                options={statusOptions.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
                selectedValues={selectedStatuses}
                onSelectionChange={setSelectedStatuses}
                placeholder="Status"
              />

              <MultiSelectSearchFilterDropdown
                searchFn={searchProperties}
                selectedValues={selectedProperties}
                onSelectionChange={setSelectedProperties}
                placeholder="Fastighet"
                searchPlaceholder="Sök fastighet"
              />

              <MultiSelectFilterDropdown
                options={districtOptions.map((o) => ({ label: o, value: o }))}
                selectedValues={selectedDistricts}
                onSelectionChange={setSelectedDistricts}
                placeholder="Distrikt"
              />

              <MultiSelectSearchFilterDropdown
                searchFn={searchBuildingManagers}
                minSearchLength={0}
                selectedValues={selectedBuildingManagers}
                onSelectionChange={setSelectedBuildingManagers}
                placeholder="Kvartersvärd"
                searchPlaceholder="Sök kvartersvärd"
              />

              <DateRangeFilterDropdown
                startDate={startDateFrom || null}
                endDate={startDateTo || null}
                onDateChange={setStartDateRange}
                placeholder="Startdatum"
              />

              <DateRangeFilterDropdown
                startDate={endDateFrom || null}
                endDate={endDateTo || null}
                onDateChange={setEndDateRange}
                placeholder="Slutdatum"
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
              Laddar hyreskontrakt...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av hyreskontrakt
            </div>
          ) : displayLeases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga hyreskontrakt hittades
            </div>
          ) : (
            <ResponsiveTable
              data={displayLeases}
              columns={[
                {
                  key: 'leaseId',
                  label: 'Kontraktsnummer',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) => (
                    <span className="font-medium">{lease.leaseId}</span>
                  ),
                },
                {
                  key: 'contacts',
                  label: 'Hyresgäst',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) => {
                    if (!lease.contacts || lease.contacts.length === 0) {
                      return <span className="text-muted-foreground">-</span>
                    }
                    return (
                      <div className="space-y-1">
                        {lease.contacts.map((contact) => (
                          <div key={contact.contactCode}>
                            <Link
                              to={`/tenants/${contact.contactCode}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {contact.name}
                            </Link>
                            <div className="text-sm text-muted-foreground">
                              {contact.contactCode}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  },
                },
                {
                  key: 'contactInfo',
                  label: 'Kontaktuppgifter',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) => {
                    if (!lease.contacts || lease.contacts.length === 0) {
                      return <span className="text-muted-foreground">-</span>
                    }
                    return (
                      <div className="space-y-2">
                        {lease.contacts.map((contact) => (
                          <div key={contact.contactCode}>
                            {contact.email && (
                              <div className="text-sm">{contact.email}</div>
                            )}
                            {contact.phone && (
                              <div className="text-sm text-muted-foreground">
                                {contact.phone}
                              </div>
                            )}
                            {!contact.email && !contact.phone && (
                              <span className="text-sm text-muted-foreground">
                                -
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  },
                  hideOnMobile: true,
                },
                {
                  key: 'objectType',
                  label: 'Objekttyp',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) => (
                    <ObjectTypeBadge type={lease.objectTypeCode} />
                  ),
                  hideOnMobile: true,
                },
                {
                  key: 'address',
                  label: 'Adress',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) => lease.address || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'startDate',
                  label: 'Startdatum',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) =>
                    formatDate(lease.startDate),
                  hideOnMobile: true,
                },
                {
                  key: 'lastDebitDate',
                  label: 'Slutdatum',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) =>
                    formatDate(lease.lastDebitDate),
                },
                {
                  key: 'status',
                  label: 'Status',
                  className: 'px-2',
                  render: (lease: LeaseSearchResult) => (
                    <LeaseStatusBadge status={lease.status} />
                  ),
                  hideOnMobile: true,
                },
              ]}
              keyExtractor={(lease) => lease.leaseId}
              mobileCardRenderer={(lease: LeaseSearchResult) => (
                <div className="space-y-3 w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">{lease.leaseId}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(lease.startDate)} -{' '}
                        {formatDate(lease.lastDebitDate)}
                      </div>
                    </div>
                    <LeaseStatusBadge status={lease.status} />
                  </div>
                  <div className="space-y-2 text-sm">
                    {lease.contacts && lease.contacts.length > 0 ? (
                      lease.contacts.map((contact) => (
                        <div
                          key={contact.contactCode}
                          className="flex justify-between"
                        >
                          <span className="text-muted-foreground">
                            Hyresgäst:
                          </span>
                          <Link
                            to={`/tenants/${contact.contactCode}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {contact.name}
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Hyresgäst:
                        </span>
                        <span className="text-muted-foreground">-</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Adress:</span>
                      <span>{lease.address || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Objekttyp:</span>
                      <ObjectTypeBadge type={lease.objectTypeCode} />
                    </div>
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

export default LeasesPage
