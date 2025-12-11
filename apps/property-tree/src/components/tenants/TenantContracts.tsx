import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { InfoIcon, Loader2 } from 'lucide-react'
import type { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'

const LeaseStatus = {
  Current: 0, // Gällande
  Upcoming: 1, // Kommande
  AboutToEnd: 2, // Uppsagt, kommer att upphöra
  Ended: 3, // Upphört
} as const

interface TenantContractsProps {
  leases: Lease[] // replace with real type representing response from leases/by-contact-code
  rentalProperties: Record<string, RentalPropertyInfo | null>
  isLoadingLeases?: boolean
  isLoadingProperties?: boolean
}

export function TenantContracts({
  leases,
  rentalProperties,
  isLoadingLeases = false,
  isLoadingProperties = false,
}: TenantContractsProps) {
  // Show loading state while leases are being fetched
  if (isLoadingLeases) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kontrakt</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Hämtar kontrakt...
          </p>
        </CardContent>
      </Card>
    )
  }

  // Show empty state if no leases
  if (!leases.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kontrakt</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Inga kontrakt hittades
          </p>
        </CardContent>
      </Card>
    )
  }

  // Sort leases with three tiers:
  // 1. Active/upcoming leases (with property data)
  // 2. Ended leases (with property data)
  // 3. Leases with missing property data
  const sortedLeases = [...leases].sort((a, b) => {
    const aHasProperty = !!rentalProperties[a.rentalPropertyId]
    const bHasProperty = !!rentalProperties[b.rentalPropertyId]
    // API returns numeric values despite TypeScript types
    const aIsEnded = Number(a.status) === LeaseStatus.Ended
    const bIsEnded = Number(b.status) === LeaseStatus.Ended

    // If both have property data or both don't, sort by ended status
    if (aHasProperty === bHasProperty) {
      if (aIsEnded && !bIsEnded) return 1 // a is ended, b is not -> a goes after b
      if (!aIsEnded && bIsEnded) return -1 // a is not ended, b is -> a goes before b
      return 0 // Keep original order for items in same category
    }

    // Otherwise, prioritize those with property data
    if (aHasProperty && !bHasProperty) return -1
    if (!aHasProperty && bHasProperty) return 1
    return 0
  })

  const formatRentalType = (rentalType: string) => {
    // Remove " hyresobjektstyp" suffix if present ("Standard hyresobjektstyp" -> "Standard")
    return rentalType.replace(/ hyresobjektstyp$/i, '').trim()
  }

  const getStatusBadge = (status: Lease['status']) => {
    // Note: The generated TypeScript types say status is a string enum,
    // but the actual API returns numeric values (0, 1, 2, 3)
    const numericStatus = Number(status)

    switch (numericStatus) {
      case LeaseStatus.Current:
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
          >
            Gällande
          </Badge>
        )
      case LeaseStatus.Upcoming:
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
          >
            Kommande
          </Badge>
        )
      case LeaseStatus.AboutToEnd:
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200"
          >
            Upphör snart
          </Badge>
        )
      case LeaseStatus.Ended:
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
          >
            Upphört
          </Badge>
        )
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPropertyIdentifier = (rentalProperty: RentalPropertyInfo | null) => {
    if (!rentalProperty) return 'Data ej tillgänglig'

    const type = rentalProperty.type
    const property = rentalProperty.property

    if (type === 'Lägenhet' && 'number' in property) {
      return property.number || ''
    }
    if (type === 'Bilplats') {
      return property.code || ''
    }
    // Default fallback for other types
    return ('number' in property && property.number) || property.code || ''
  }

  const formatAddress = (address: string) => {
    if (!address) return ''
    // Capitalize only the first letter, rest lowercase
    return address.charAt(0).toUpperCase() + address.slice(1).toLowerCase()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Kontrakt</CardTitle>
          {isLoadingProperties && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Hämtar objektsdetaljer...</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ</TableHead>
              <TableHead>Kontraktsnummer</TableHead>
              <TableHead>Objekt</TableHead>
              <TableHead>Lägenhetsnummer/Skyltnummer</TableHead>
              <TableHead>Startdatum</TableHead>
              <TableHead>Slutdatum</TableHead>
              <TableHead>Månadshyra</TableHead>
              <TableHead>Kontrakttyp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeases.map((lease) => {
              const rentalProperty = rentalProperties[lease.rentalPropertyId]
              const isPropertyLoading =
                isLoadingProperties && rentalProperty === undefined

              return (
                <TableRow key={lease.leaseId}>
                  <TableCell>
                    {isPropertyLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Laddar...</span>
                      </div>
                    ) : !rentalProperty ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                              <InfoIcon className="h-4 w-4" />
                              <span>Data ej tillgänglig</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Observera att vi inte alltid kan hämta data för
                              sålda objekt
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span>{rentalProperty.type}</span>
                    )}
                  </TableCell>
                  <TableCell>{lease.leaseNumber}</TableCell>
                  <TableCell>
                    {isPropertyLoading ? (
                      <>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Laddar...</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {lease.rentalPropertyId}
                        </div>
                      </>
                    ) : !rentalProperty ? (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                <InfoIcon className="h-4 w-4" />
                                <span>Data ej tillgänglig</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Observera att vi inte alltid kan hämta data för
                                sålda objekt
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="text-sm text-muted-foreground mt-1">
                          {lease.rentalPropertyId}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="whitespace-nowrap">
                          {formatAddress(rentalProperty.property.address)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lease.rentalPropertyId}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    {isPropertyLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Laddar...</span>
                      </div>
                    ) : !rentalProperty ? (
                      <span className="text-muted-foreground">
                        Data ej tillgänglig
                      </span>
                    ) : (
                      getPropertyIdentifier(rentalProperty)
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{formatDate(lease.leaseStartDate)}</div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {lease.lastDebitDate
                        ? formatDate(lease.lastDebitDate)
                        : ''}
                    </div>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>
                    {isPropertyLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Laddar...</span>
                      </div>
                    ) : !rentalProperty ? (
                      <span className="text-muted-foreground">
                        Data ej tillgänglig
                      </span>
                    ) : rentalProperty.property.rentalType ? (
                      formatRentalType(rentalProperty.property.rentalType)
                    ) : (
                      ''
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(lease.status)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" disabled>
                      Visa kontrakt
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
