import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  Filter,
  Plus,
  Download,
  List,
  Grid3X3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  KeySystem,
  KeySystemTypeLabels,
  Key,
  KeyTypeLabels,
  Property,
} from '@/services/types'
import { sampleProperties } from '@/mockdata/sampleProperties'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

// Sample data - this would come from your data store/API
const sampleKeySystems: KeySystem[] = [
  {
    id: '1',
    system_code: 'ABC123',
    name: 'Huvudentré System',
    manufacturer: 'ASSA ABLOY',
    managing_supplier: 'Låsteknik AB',
    type: 'ELECTRONIC',
    property_ids: ['prop1', 'prop2'],
    installation_date: '2023-01-15T00:00:00Z',
    is_active: true,
    description: 'Elektroniskt låssystem för huvudentréer',
    createdAt: '2023-01-15T10:00:00Z',
    updatedAt: '2023-01-15T10:00:00Z',
    created_by: 'admin',
    updated_by: 'admin',
  },
  {
    id: '2',
    system_code: 'DEF456',
    name: 'Källarsystem',
    manufacturer: 'Securitas',
    managing_supplier: 'Säkerhet Nord AB',
    type: 'MECHANICAL',
    installation_date: '2022-06-20T00:00:00Z',
    is_active: true,
    description: 'Mekaniskt system för källarutrymmen',
    createdAt: '2022-06-20T10:00:00Z',
    updatedAt: '2022-06-20T10:00:00Z',
    created_by: 'admin',
    updated_by: 'admin',
  },
  {
    id: '3',
    system_code: 'GHI789',
    name: 'Kombinerat System',
    manufacturer: 'ASSA ABLOY',
    managing_supplier: 'Låsteknik AB',
    type: 'HYBRID',
    installation_date: '2023-08-10T00:00:00Z',
    is_active: false,
    description:
      'Hybrid system med både elektroniska och mekaniska komponenter',
    createdAt: '2023-08-10T10:00:00Z',
    updatedAt: '2023-09-01T10:00:00Z',
    created_by: 'admin',
    updated_by: 'admin',
  },
]

// Sample keys data with realistic distribution
const generateSampleKeys = (systemCode: string): Key[] => {
  const rentalObjects = [
    'Minken 1 lgh 1001',
    'Minken 1 lgh 1002',
    'Minken 1 lgh 1003',
    'Minken 1 lgh 1004',
    'Bävern 2 lgh 2001',
    'Bävern 2 lgh 2002',
    'Bävern 2 lgh 2003',
    'Bävern 2 lgh 2004',
    'Ekorre 3 lgh 3001',
    'Ekorre 3 lgh 3002',
    'Ekorre 3 lgh 3003',
    'Räven 4 lgh 4001',
    'Räven 4 lgh 4002',
    'Räven 4 lgh 4003',
    'Räven 4 lgh 4004',
    'Björn 5 lgh 5001',
    'Björn 5 lgh 5002',
    'Björn 5 lgh 5003',
    'Älg 6 lgh 6001',
    'Älg 6 lgh 6002',
  ]

  const keys: Key[] = []
  let keyId = 1

  // Generate keys for each rental object
  rentalObjects.forEach((rentalObject, objIndex) => {
    const apartmentNumber = rentalObject.split(' lgh ')[1]
    const buildingPrefix = rentalObject
      .split(' ')[0]
      .substring(0, 3)
      .toUpperCase()

    // 3-5 apartment keys (LGH)
    const numLghKeys = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < numLghKeys; i++) {
      keys.push({
        id: `${systemCode}-${keyId}`,
        keyName: `${buildingPrefix}-${apartmentNumber}-LGH-${i + 1}`,
        keySequenceNumber: keyId,
        flexNumber: objIndex + 1,
        rentalObject: rentalObject,
        keyType: 'LGH',
        keySystemName: systemCode,
        createdAt: new Date(
          2023,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 28) + 1
        ).toISOString(),
        updatedAt: new Date(
          2023,
          Math.floor(Math.random() * 6) + 7,
          Math.floor(Math.random() * 28) + 1
        ).toISOString(),
      })
      keyId++
    }

    // 3-5 postbox keys (PB)
    const numPbKeys = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < numPbKeys; i++) {
      keys.push({
        id: `${systemCode}-${keyId}`,
        keyName: `${buildingPrefix}-${apartmentNumber}-PB-${i + 1}`,
        keySequenceNumber: keyId,
        flexNumber: objIndex + 1,
        rentalObject: rentalObject,
        keyType: 'PB',
        keySystemName: systemCode,
        createdAt: new Date(
          2023,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 28) + 1
        ).toISOString(),
        updatedAt: new Date(
          2023,
          Math.floor(Math.random() * 6) + 7,
          Math.floor(Math.random() * 28) + 1
        ).toISOString(),
      })
      keyId++
    }

    // 1-2 storage keys (FS)
    const numFsKeys = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < numFsKeys; i++) {
      keys.push({
        id: `${systemCode}-${keyId}`,
        keyName: `${buildingPrefix}-${apartmentNumber}-FS-${i + 1}`,
        keySequenceNumber: keyId,
        flexNumber: objIndex + 1,
        rentalObject: rentalObject,
        keyType: 'FS',
        keySystemName: systemCode,
        createdAt: new Date(
          2023,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 28) + 1
        ).toISOString(),
        updatedAt: new Date(
          2023,
          Math.floor(Math.random() * 6) + 7,
          Math.floor(Math.random() * 28) + 1
        ).toISOString(),
      })
      keyId++
    }
  })

  // Add 2-3 system-wide master keys (HN) - not tied to specific rental objects
  const numHnKeys = 2 + Math.floor(Math.random() * 2)
  for (let i = 0; i < numHnKeys; i++) {
    keys.push({
      id: `${systemCode}-${keyId}`,
      keyName: `${systemCode}-HUVUD-${i + 1}`,
      keySequenceNumber: keyId,
      flexNumber: 999, // Special flex number for master keys
      keyType: 'HN',
      keySystemName: systemCode,
      createdAt: new Date(2023, 0, 15 + i).toISOString(), // Created early in the system setup
      updatedAt: new Date(2023, 0, 15 + i).toISOString(),
    })
    keyId++
  }

  return keys
}

const KEYS_PER_PAGE = 50

type ViewMode = 'list' | 'grouped'

export default function KeySystemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKeyType, setSelectedKeyType] = useState('all')
  const [sortBy, setSortBy] = useState('keyName')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('KeySystemDetailViewMode')
    return (saved as ViewMode) || 'list'
  })

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('KeySystemDetailViewMode', viewMode)
  }, [viewMode])

  // Find the lock system
  const KeySystem = sampleKeySystems.find((ls) => ls.id === id)

  // Generate keys for this system
  const allKeys = useMemo(() => {
    if (!KeySystem) return []
    return generateSampleKeys(KeySystem.system_code)
  }, [KeySystem])

  // Get associated properties
  const properties = useMemo(() => {
    if (!KeySystem?.property_ids) return []
    return sampleProperties.filter((prop) =>
      KeySystem.property_ids?.includes(prop.id)
    )
  }, [KeySystem])

  // Filter and sort keys
  const filteredAndSortedKeys = useMemo(() => {
    const filtered = allKeys.filter((key) => {
      const matchesSearch =
        key.keyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (key.rentalObject &&
          key.rentalObject.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesType =
        selectedKeyType === 'all' || key.keyType === selectedKeyType

      return matchesSearch && matchesType
    })

    // Sort keys
    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof Key]
      let bVal: any = b[sortBy as keyof Key]

      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })

    return filtered
  }, [allKeys, searchQuery, selectedKeyType, sortBy, sortOrder])

  // Count keys by type for each rental object
  const getKeyTypeCount = (keys: Key[]) => {
    const counts = { LGH: 0, PB: 0, FS: 0, HN: 0 }
    keys.forEach((key) => {
      counts[key.keyType as keyof typeof counts]++
    })
    return counts
  }

  // Group keys by rental object for grouped view
  const groupedKeys = useMemo(() => {
    const groups: Record<string, Key[]> = {}

    filteredAndSortedKeys.forEach((key) => {
      const rentalObject = key.rentalObject || 'Ingen hyresobjekt'
      if (!groups[rentalObject]) {
        groups[rentalObject] = []
      }
      groups[rentalObject].push(key)
    })

    // Sort groups by rental object name and sort keys within each group
    const sortedGroups = Object.keys(groups)
      .sort()
      .reduce(
        (acc, rentalObject) => {
          acc[rentalObject] = groups[rentalObject].sort((a, b) => {
            let aVal: any = a[sortBy as keyof Key]
            let bVal: any = b[sortBy as keyof Key]

            if (typeof aVal === 'string') aVal = aVal.toLowerCase()
            if (typeof bVal === 'string') bVal = bVal.toLowerCase()

            if (sortOrder === 'asc') {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
            } else {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
            }
          })
          return acc
        },
        {} as Record<string, Key[]>
      )

    return sortedGroups
  }, [filteredAndSortedKeys, sortBy, sortOrder])

  // Paginate keys (only for list view)
  const totalPages = Math.ceil(filteredAndSortedKeys.length / KEYS_PER_PAGE)
  const paginatedKeys =
    viewMode === 'list'
      ? filteredAndSortedKeys.slice(
          (currentPage - 1) * KEYS_PER_PAGE,
          currentPage * KEYS_PER_PAGE
        )
      : []

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PP', { locale: sv })
    } catch {
      return dateString
    }
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  if (!KeySystem) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Låssystem hittades inte</h1>
          <Button onClick={() => navigate('/key-systems')}>
            Tillbaka till låssystem
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigate('/key-systems')}
              className="cursor-pointer"
            >
              Låssystem
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{KeySystem.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/key-systems')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {KeySystem.name}
            <Badge variant="outline">{KeySystem.system_code}</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedKeys.length} nycklar totalt
          </p>
        </div>
      </div>

      {/* Key System Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-4">Systemdetaljer</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Typ:</span>
              <Badge variant="secondary">
                {KeySystemTypeLabels[KeySystem.type]}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tillverkare:</span>
              <span>{KeySystem.manufacturer || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leverantör:</span>
              <span>{KeySystem.managing_supplier || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={KeySystem.is_active ? 'default' : 'secondary'}>
                {KeySystem.is_active ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installation:</span>
              <span>
                {KeySystem.installation_date
                  ? formatDate(KeySystem.installation_date)
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-4">
            Fastigheter ({properties.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {properties.length > 0 ? (
              properties.map((property) => (
                <Badge key={property.id} variant="outline">
                  {property.name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">
                Inga fastigheter kopplade
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Keys Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Nycklar</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportera
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Lägg till nyckel
            </Button>
          </div>
        </div>

        {/* Filters, Search, and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök nycklar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={selectedKeyType} onValueChange={setSelectedKeyType}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrera typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla typer</SelectItem>
                <SelectItem value="LGH">Lägenhet</SelectItem>
                <SelectItem value="PB">Postbox</SelectItem>
                <SelectItem value="FS">Förråd/Source</SelectItem>
                <SelectItem value="HN">Huvudnyckel</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex border rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-3"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grouped')}
                className="px-3"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Keys Display */}
        {viewMode === 'list' ? (
          /* List View */
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('keyName')}
                  >
                    Nyckelnamn{' '}
                    {sortBy === 'keyName' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('keySequenceNumber')}
                  >
                    Sekvens{' '}
                    {sortBy === 'keySequenceNumber' &&
                      (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('flexNumber')}
                  >
                    Flex Nr{' '}
                    {sortBy === 'flexNumber' &&
                      (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Hyresobjekt</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('keyType')}
                  >
                    Typ{' '}
                    {sortBy === 'keyType' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('createdAt')}
                  >
                    Skapad{' '}
                    {sortBy === 'createdAt' &&
                      (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedKeys.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {filteredAndSortedKeys.length === 0
                        ? 'Inga nycklar hittades'
                        : 'Inga nycklar på denna sida'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        {key.keyName}
                      </TableCell>
                      <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                      <TableCell>{key.flexNumber || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {key.rentalObject || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {KeyTypeLabels[key.keyType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(key.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Grouped View */
          <div className="space-y-4">
            {Object.keys(groupedKeys).length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border rounded-lg">
                Inga nycklar hittades
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {Object.entries(groupedKeys).map(([rentalObject, keys]) => (
                  <AccordionItem
                    key={rentalObject}
                    value={rentalObject}
                    className="border rounded-lg"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                      <div className="flex items-center justify-between w-full mr-4">
                        <span className="font-medium">{rentalObject}</span>
                        <div className="flex gap-1 ml-2">
                          {(() => {
                            const counts = getKeyTypeCount(keys)
                            return Object.entries(counts)
                              .filter(([, count]) => count > 0)
                              .map(([keyType, count]) => (
                                <Badge
                                  key={keyType}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {count}{' '}
                                  {
                                    KeyTypeLabels[
                                      keyType as keyof typeof KeyTypeLabels
                                    ]
                                  }
                                </Badge>
                              ))
                          })()}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-4">Nyckelnamn</TableHead>
                              <TableHead>Sekvens</TableHead>
                              <TableHead>Flex Nr</TableHead>
                              <TableHead>Typ</TableHead>
                              <TableHead className="pr-4">Skapad</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {keys.map((key) => (
                              <TableRow key={key.id}>
                                <TableCell className="font-medium pl-4">
                                  {key.keyName}
                                </TableCell>
                                <TableCell>
                                  {key.keySequenceNumber || '-'}
                                </TableCell>
                                <TableCell>{key.flexNumber || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {KeyTypeLabels[key.keyType]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm pr-4">
                                  {formatDate(key.createdAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}

        {/* Pagination - Only show in list view */}
        {viewMode === 'list' && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Visar {(currentPage - 1) * KEYS_PER_PAGE + 1}-
              {Math.min(
                currentPage * KEYS_PER_PAGE,
                filteredAndSortedKeys.length
              )}{' '}
              av {filteredAndSortedKeys.length} nycklar
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={
                      currentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  )
}
