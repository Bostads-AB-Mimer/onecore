import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { KeySystem, KeySystemTypeLabels, Property, Key } from '@/services/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { useState, useEffect } from 'react'
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'

interface KeySystemsTableProps {
  KeySystems: KeySystem[]
  propertyMap: Map<string, Property>
  onEdit: (KeySystem: KeySystem) => void
  onDelete: (id: string) => void
  onExplore: (KeySystem: KeySystem) => void
  expandedSystemId: string | null
  onToggleExpand: (systemId: string) => void
  keysForExpandedSystem: Key[]
  isLoadingKeys: boolean
}

export function KeySystemsTable({
  KeySystems,
  propertyMap,
  onEdit,
  onDelete,
  expandedSystemId,
  onToggleExpand,
  keysForExpandedSystem,
  isLoadingKeys,
}: KeySystemsTableProps) {
  const navigate = useNavigate()
  const [addressMap, setAddressMap] = useState<Record<string, string>>({})
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)

  // Fetch addresses when keys change
  useEffect(() => {
    const fetchAddresses = async () => {
      if (keysForExpandedSystem.length === 0) {
        setAddressMap({})
        return
      }

      setIsLoadingAddresses(true)
      try {
        const rentalObjectCodes = [
          ...new Set(
            keysForExpandedSystem
              .map((key) => key.rentalObjectCode)
              .filter((code): code is string => code != null && code !== '')
          ),
        ]

        const addresses =
          await rentalObjectSearchService.getAddressesByRentalIds(
            rentalObjectCodes
          )
        setAddressMap(addresses)
      } catch (error) {
        console.error('Failed to fetch addresses:', error)
        setAddressMap({})
      } finally {
        setIsLoadingAddresses(false)
      }
    }

    fetchAddresses()
  }, [keysForExpandedSystem])

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'MECHANICAL':
        return 'secondary'
      case 'ELECTRONIC':
        return 'default'
      case 'HYBRID':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PP', { locale: sv })
    } catch {
      return dateString
    }
  }

  // Group keys by rental object code
  const groupedKeys = keysForExpandedSystem.reduce(
    (acc, key) => {
      const code = key.rentalObjectCode || 'Ingen objektkod'
      if (!acc[code]) {
        acc[code] = []
      }
      acc[code].push(key)
      return acc
    },
    {} as Record<string, Key[]>
  )

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Systemkod</TableHead>
            <TableHead>Namn</TableHead>
            <TableHead>Tillverkare</TableHead>
            <TableHead>Fastigheter</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Installationsdatum</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {KeySystems.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center text-muted-foreground py-8"
              >
                Inga låssystem hittades
              </TableCell>
            </TableRow>
          ) : (
            KeySystems.map((KeySystem) => {
              // Parse propertyIds if it's a JSON string
              let propertyIdArray: string[] = []
              if (KeySystem.propertyIds) {
                try {
                  const parsed =
                    typeof KeySystem.propertyIds === 'string'
                      ? JSON.parse(KeySystem.propertyIds)
                      : KeySystem.propertyIds
                  propertyIdArray = Array.isArray(parsed) ? parsed : []
                } catch (e) {
                  console.error('Failed to parse propertyIds:', e)
                }
              }

              const properties = propertyIdArray
                .map((id) => propertyMap.get(id))
                .filter((prop): prop is Property => prop !== undefined)

              const isExpanded = expandedSystemId === KeySystem.id

              return (
                <>
                  <TableRow key={KeySystem.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleExpand(KeySystem.id)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {KeySystem.systemCode}
                    </TableCell>
                    <TableCell>{KeySystem.name}</TableCell>
                    <TableCell>{KeySystem.manufacturer || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {properties.length > 0 ? (
                          properties.map((property) => (
                            <Badge
                              key={property.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {property.designation}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            -
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeVariant(KeySystem.type)}>
                        {KeySystemTypeLabels[KeySystem.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={KeySystem.isActive ? 'default' : 'secondary'}
                      >
                        {KeySystem.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {KeySystem.installationDate
                        ? formatDate(KeySystem.installationDate.toString())
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/key-systems/${KeySystem.id}`)
                            }
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Utforska
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(KeySystem)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Redigera
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(KeySystem.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Ta bort
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={9} className="bg-muted/50 p-4">
                        {isLoadingKeys ? (
                          <div className="text-center py-4 text-muted-foreground">
                            Laddar nycklar...
                          </div>
                        ) : keysForExpandedSystem.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            Inga nycklar hittades för detta låssystem
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <h3 className="font-semibold text-sm">
                              Nycklar grupperade efter objekt
                            </h3>
                            {Object.entries(groupedKeys).map(
                              ([rentalObjectCode, keys]) => (
                                <div
                                  key={rentalObjectCode}
                                  className="border rounded-lg p-3 bg-background"
                                >
                                  <div className="mb-2 font-medium text-sm">
                                    {rentalObjectCode} -{' '}
                                    <span className="text-muted-foreground font-normal">
                                      {isLoadingAddresses
                                        ? 'Laddar adress...'
                                        : addressMap[rentalObjectCode] ||
                                          'Okänd adress'}
                                    </span>{' '}
                                    ({keys.length}{' '}
                                    {keys.length === 1 ? 'nyckel' : 'nycklar'})
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {keys.map((key) => (
                                      <div
                                        key={key.id}
                                        className="text-sm p-2 border rounded bg-card"
                                      >
                                        <div className="font-medium">
                                          {key.keyName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {key.keyType && (
                                            <span>Typ: {key.keyType}</span>
                                          )}
                                          {key.keySequenceNumber && (
                                            <span className="ml-2">
                                              Seq: {key.keySequenceNumber}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
