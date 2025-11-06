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
import type { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/lease-service'
import { RentalProperty } from '@/services/api/core/rentalPropertyService'

const LeaseStatus = {
  Current: 0, // Gällande
  Upcoming: 1, // Kommande
  AboutToEnd: 2, // Uppsagt, kommer att upphöra
  Ended: 3, // Upphört
} as const

interface TenantContractsProps {
  leases: Lease[] // replace with real type representing response from leases/by-contact-code
  rentalProperties: Record<string, RentalProperty>
}

export function TenantContracts({
  leases,
  rentalProperties,
}: TenantContractsProps) {
  if (!leases.length) {
    return null
  }

  const formatRentalType = (rentalType: string) => {
    // Remove " hyresobjektstyp" suffix if present ("Standard hyresobjektstyp" -> "Standard")
    return rentalType.replace(/ hyresobjektstyp$/i, '').trim()
  }

  const getStatusBadge = (status: Lease['status']) => {
    // Note: The generated TypeScript types say status is a string enum,
    // but the actual API returns numeric values (0, 1, 2, 3)
    // We cast to any to handle this type mismatch
    const numericStatus = status as any

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontrakt</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ</TableHead>
              <TableHead>Kontraktsnummer</TableHead>
              <TableHead>Objekt</TableHead>
              <TableHead>Startdatum</TableHead>
              <TableHead>Slutdatum</TableHead>
              <TableHead>Månadshyra</TableHead>
              <TableHead>Kontrakttyp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease) => {
              const rentalProperty = rentalProperties[lease.rentalPropertyId]
              return (
                <TableRow key={lease.leaseId}>
                  <TableCell>
                    <div className="flex items-center">
                      <span>{rentalProperty?.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lease.leaseNumber}</TableCell>
                  <TableCell>{lease.rentalPropertyId}</TableCell>
                  <TableCell>
                    <div>{formatDate(lease.leaseStartDate)}</div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {lease.leaseEndDate ? formatDate(lease.leaseEndDate) : ''}
                    </div>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>
                    {rentalProperty?.property.rentalType
                      ? formatRentalType(rentalProperty.property.rentalType)
                      : ''}
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
