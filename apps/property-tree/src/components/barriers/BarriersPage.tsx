import { useMemo, useState } from 'react'
import { Search, Calendar, X } from 'lucide-react'
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
import { useAllRentalBlocks } from '@/components/hooks/useRentalBlocks'
import { RentalBlockWithResidence } from '@/services/api/core/residenceService'

// Category options matching backend enum
const kategoriOptions = [
  'Bostad',
  'Bilplats',
  'Lokal',
  'Förråd',
  'Övrigt',
] as const

const formatISODate = (isoDateString: string | null | undefined) => {
  if (!isoDateString) return '-'
  const date = new Date(isoDateString)
  return date.toLocaleDateString('sv-SE')
}

const isExpired = (toDate: string | null | undefined) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return toDate ? new Date(toDate) < today : false
}

const BarriersPage = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKategori, setSelectedKategori] = useState<string>('')
  const [selectedFastighet, setSelectedFastighet] = useState<string>('')
  const [selectedOrsak, setSelectedOrsak] = useState<string>('')
  const [selectedDistrikt, setSelectedDistrikt] = useState<string>('')
  const [startDatum, setStartDatum] = useState<string>('')
  const [slutDatum, setSlutDatum] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<
    'active' | 'expired' | 'all'
  >('active')

  const { data: rentalBlocks, isLoading, error } = useAllRentalBlocks()

  // Derive unique filter options from data
  const uniqueFastigheter = useMemo(() => {
    if (!rentalBlocks) return []
    const properties = rentalBlocks
      .map((b) => b.property.name)
      .filter((name): name is string => !!name)
    return [...new Set(properties)].sort()
  }, [rentalBlocks])

  const uniqueOrsaker = useMemo(() => {
    if (!rentalBlocks) return []
    const reasons = rentalBlocks
      .map((b) => b.blockReason)
      .filter((reason): reason is string => !!reason)
    return [...new Set(reasons)].sort()
  }, [rentalBlocks])

  const uniqueDistrikter = useMemo(() => {
    if (!rentalBlocks) return []
    const distrikter = rentalBlocks
      .map((b) => b.distrikt)
      .filter((d): d is string => !!d)
    return [...new Set(distrikter)].sort()
  }, [rentalBlocks])

  const filteredBlocks = useMemo(() => {
    if (!rentalBlocks) return []

    return rentalBlocks.filter((block) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        block.rentalObject.rentalId?.toLowerCase().includes(searchLower) ||
        block.rentalObject.name?.toLowerCase().includes(searchLower) ||
        block.rentalObject.code?.toLowerCase().includes(searchLower) ||
        block.rentalObject.address?.toLowerCase().includes(searchLower) ||
        block.building.name?.toLowerCase().includes(searchLower) ||
        block.blockReason?.toLowerCase().includes(searchLower) ||
        block.property.name?.toLowerCase().includes(searchLower)

      // Status filter (active, expired, or all)
      const expired = isExpired(block.toDate)
      const matchesStatusFilter =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !expired) ||
        (statusFilter === 'expired' && expired)

      // Fastighet filter
      const matchesFastighet =
        !selectedFastighet || block.property.name === selectedFastighet

      // Orsak filter
      const matchesOrsak = !selectedOrsak || block.blockReason === selectedOrsak

      // Date filters
      const blockFromDate = block.fromDate ? new Date(block.fromDate) : null
      const blockToDate = block.toDate ? new Date(block.toDate) : null
      const filterStartDatum = startDatum ? new Date(startDatum) : null
      const filterSlutDatum = slutDatum ? new Date(slutDatum) : null

      const matchesStartDatum =
        !filterStartDatum ||
        (blockFromDate && blockFromDate >= filterStartDatum)
      const matchesSlutDatum =
        !filterSlutDatum || (blockToDate && blockToDate <= filterSlutDatum)

      // Kategori filter - filters by Bostad/Bilplats
      const matchesKategori =
        !selectedKategori || block.rentalObject.category === selectedKategori

      // Distrikt filter
      const matchesDistrikt =
        !selectedDistrikt || block.distrikt === selectedDistrikt

      return (
        matchesSearch &&
        matchesStatusFilter &&
        matchesFastighet &&
        matchesOrsak &&
        matchesStartDatum &&
        matchesSlutDatum &&
        matchesKategori &&
        matchesDistrikt
      )
    })
  }, [
    rentalBlocks,
    searchQuery,
    statusFilter,
    selectedFastighet,
    selectedOrsak,
    startDatum,
    slutDatum,
    selectedKategori,
    selectedDistrikt,
  ])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedKategori('')
    setSelectedFastighet('')
    setSelectedDistrikt('')
    setSelectedOrsak('')
    setStartDatum('')
    setSlutDatum('')
    setStatusFilter('active')
  }

  const hasActiveFilters =
    searchQuery ||
    selectedKategori ||
    selectedFastighet ||
    selectedDistrikt ||
    selectedOrsak ||
    startDatum ||
    slutDatum ||
    statusFilter !== 'active'

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
          <span className="text-sm text-muted-foreground">
            {filteredBlocks.length} resultat
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            {/* Search input with icon */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på hyresobjekt, fastighet, adress eller orsak..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

              <Select
                value={selectedKategori}
                onValueChange={setSelectedKategori}
              >
                <SelectTrigger className="w-[140px] font-semibold">
                  <SelectValue placeholder="Kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {kategoriOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedFastighet}
                onValueChange={setSelectedFastighet}
              >
                <SelectTrigger className="w-[140px] font-semibold">
                  <SelectValue placeholder="Fastighet..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueFastigheter.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedDistrikt}
                onValueChange={setSelectedDistrikt}
              >
                <SelectTrigger className="w-[140px] font-semibold">
                  <SelectValue placeholder="Distrikt..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueDistrikter.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedOrsak} onValueChange={setSelectedOrsak}>
                <SelectTrigger className="w-[140px] font-semibold">
                  <SelectValue placeholder="Orsak..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueOrsaker.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date filters styled like Lovable reference */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="w-[160px] pl-10 font-semibold"
                  value={startDatum}
                  onChange={(e) => setStartDatum(e.target.value)}
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="w-[160px] pl-10 font-semibold"
                  value={slutDatum}
                  onChange={(e) => setSlutDatum(e.target.value)}
                />
              </div>
            </div>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Rensa filter
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
          ) : filteredBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga spärrar hittades
            </div>
          ) : (
            <ResponsiveTable
              data={filteredBlocks}
              columns={[
                {
                  key: 'hyresobjekt',
                  label: 'Hyresobjekt',
                  render: (block: RentalBlockWithResidence) => (
                    <span className="font-medium">
                      {block.rentalObject.rentalId ||
                        block.rentalObject.code ||
                        '-'}
                    </span>
                  ),
                },
                {
                  key: 'kategori',
                  label: 'Kategori',
                  render: (block: RentalBlockWithResidence) => (
                    <Badge variant="secondary">
                      {block.rentalObject.category}
                    </Badge>
                  ),
                  hideOnMobile: true,
                },
                {
                  key: 'typ',
                  label: 'Typ',
                  render: (block: RentalBlockWithResidence) =>
                    block.rentalObject.type || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'adress',
                  label: 'Adress',
                  render: (block: RentalBlockWithResidence) =>
                    block.rentalObject.address || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'fastighet',
                  label: 'Fastighet',
                  render: (block: RentalBlockWithResidence) =>
                    block.property.name || '-',
                  hideOnMobile: true,
                },
                {
                  key: 'orsak',
                  label: 'Orsak',
                  render: (block: RentalBlockWithResidence) =>
                    block.blockReason,
                },
                {
                  key: 'startdatum',
                  label: 'Startdatum',
                  render: (block: RentalBlockWithResidence) =>
                    formatISODate(block.fromDate),
                  hideOnMobile: true,
                },
                {
                  key: 'slutdatum',
                  label: 'Slutdatum',
                  render: (block: RentalBlockWithResidence) =>
                    formatISODate(block.toDate),
                  hideOnMobile: true,
                },
                {
                  key: 'hyra',
                  label: 'Hyra',
                  render: (block: RentalBlockWithResidence) =>
                    block.rentalObject.monthlyRent
                      ? `${Math.round(block.rentalObject.monthlyRent).toLocaleString('sv-SE')} kr/mån`
                      : '-',
                  hideOnMobile: true,
                },
                {
                  key: 'hyresbortfall',
                  label: 'Estimerat Hyresbortfall',
                  render: (block: RentalBlockWithResidence) =>
                    block.amount
                      ? `${block.amount.toLocaleString('sv-SE')} kr`
                      : '-',
                  hideOnMobile: true,
                },
              ]}
              keyExtractor={(block) => block.id}
              mobileCardRenderer={(block: RentalBlockWithResidence) => (
                <div className="space-y-2 w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {block.rentalObject.rentalId ||
                          block.rentalObject.code ||
                          '-'}
                      </span>
                      <div className="text-sm text-muted-foreground">
                        {block.property.name || '-'}
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
                      {block.rentalObject.category}
                    </Badge>
                  </div>
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BarriersPage
