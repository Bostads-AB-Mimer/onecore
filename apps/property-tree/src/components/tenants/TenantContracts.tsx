import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { InfoIcon, Loader2 } from 'lucide-react'
import type { Lease } from '@/services/api/core/lease-service'
import { Link } from 'react-router-dom'
import type { RentalPropertyInfo } from '@onecore/types'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import type { ReactNode } from 'react'
import {
  formatRentalType,
  formatDate,
  formatAddress,
  getPropertyIdentifier,
  getStatusBadge,
  sortLeasesByStatus,
} from './lease-helpers.tsx'

interface TenantContractsProps {
  leases: Lease[]
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
  // Show loading state while leases OR properties are being fetched
  if (isLoadingLeases || isLoadingProperties) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kontrakt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Hämtar kontrakt och objektsdetaljer...</span>
          </div>
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

  // Helper for rendering property-dependent fields
  const renderPropertyField = (
    lease: Lease,
    content: (property: RentalPropertyInfo) => ReactNode,
    fallbackText = 'Data ej tillgänglig'
  ) => {
    const property = rentalProperties[lease.rentalPropertyId]

    if (!property) {
      // Property is null (404 response for sold properties)
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                <InfoIcon className="h-4 w-4" />
                <span>{fallbackText}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Observera att vi inte alltid kan hämta data för sålda objekt
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return content(property)
  }

  // Define table columns
  const columns = [
    {
      key: 'type',
      label: 'Typ',
      render: (lease: Lease) =>
        renderPropertyField(lease, (property) => <span>{property.type}</span>),
    },
    {
      key: 'leaseNumber',
      label: 'Kontraktsnummer',
      render: (lease: Lease) => lease.leaseNumber,
    },
    {
      key: 'property',
      label: 'Objekt',
      render: (lease: Lease) =>
        renderPropertyField(lease, (property) => (
          <>
            <div className="whitespace-nowrap">
              {formatAddress(property.property.address)}
            </div>
            <div className="text-sm text-muted-foreground">
              {lease.rentalPropertyId}
            </div>
          </>
        )),
    },
    {
      key: 'identifier',
      label: 'Lägenhets/Skyltnummer',
      render: (lease: Lease) =>
        renderPropertyField(
          lease,
          (property) => getPropertyIdentifier(property),
          'Data ej tillgänglig'
        ),
    },
    {
      key: 'tenant',
      label: 'Hyresgäst',
      render: (lease: Lease) => {
        if (!lease.tenants || lease.tenants.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <div className="space-y-1">
            {lease.tenants.map((tenant) => {
              const isValidContact =
                tenant.contactCode.startsWith('P') ||
                tenant.contactCode.startsWith('F')
              return (
                <div key={tenant.contactCode}>
                  {isValidContact ? (
                    <Link
                      to={`/tenants/${tenant.contactCode}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {tenant.fullName}
                    </Link>
                  ) : (
                    <span className="font-medium">{tenant.fullName}</span>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {tenant.contactCode}
                  </div>
                </div>
              )
            })}
          </div>
        )
      },
    },
    {
      key: 'startDate',
      label: 'Startdatum',
      render: (lease: Lease) => formatDate(lease.leaseStartDate),
    },
    {
      key: 'endDate',
      label: 'Slutdatum',
      render: (lease: Lease) =>
        lease.lastDebitDate ? formatDate(lease.lastDebitDate) : '',
    },
    {
      key: 'rent',
      label: 'Månadshyra',
      render: () => '', // Currently empty in original
    },
    {
      key: 'contractType',
      label: 'Kontrakttyp',
      render: (lease: Lease) =>
        renderPropertyField(
          lease,
          (property) =>
            property.property.rentalType
              ? formatRentalType(property.property.rentalType)
              : '',
          'Data ej tillgänglig'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (lease: Lease) => getStatusBadge(lease.status),
    },
    {
      key: 'actions',
      label: '',
      render: () => (
        <Button variant="outline" size="sm" disabled>
          Visa kontrakt
        </Button>
      ),
    },
  ]

  // Mobile card renderer
  const mobileCardRenderer = (lease: Lease) => {
    const property = rentalProperties[lease.rentalPropertyId]
    const isMissing = !property

    return (
      <div className="space-y-3 w-full">
        {/* Header: Status Badge + Lease Number */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-medium">
              Kontrakt {lease.leaseNumber}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatDate(lease.leaseStartDate)}
              {lease.lastDebitDate && ` - ${formatDate(lease.lastDebitDate)}`}
            </div>
          </div>
          {getStatusBadge(lease.status)}
        </div>

        {/* Property Info Section */}
        <div className="space-y-2 text-sm">
          {isMissing ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <InfoIcon className="h-3 w-3" />
              <span className="text-xs">
                Data ej tillgänglig (möjligen sålt objekt)
              </span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Typ:</span>
                <span className="font-medium">{property.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adress:</span>
                <span>{formatAddress(property.property.address)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Objektkod:</span>
                <span>{lease.rentalPropertyId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nummer:</span>
                <span>{getPropertyIdentifier(property)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kontrakttyp:</span>
                <span>
                  {property.property.rentalType
                    ? formatRentalType(property.property.rentalType)
                    : '-'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Tenant Info Section */}
        {lease.tenants && lease.tenants.length > 0 && (
          <div className="space-y-2 text-sm">
            {lease.tenants.map((tenant, index) => {
              const isValidContact =
                tenant.contactCode.startsWith('P') ||
                tenant.contactCode.startsWith('F')
              return (
                <div key={tenant.contactCode} className="space-y-1">
                  {index > 0 && <div className="border-t pt-2" />}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hyresgäst:</span>
                    {isValidContact ? (
                      <Link
                        to={`/tenants/${tenant.contactCode}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {tenant.fullName}
                      </Link>
                    ) : (
                      <span className="font-medium">{tenant.fullName}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kundnummer:</span>
                    <span>{tenant.contactCode}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" disabled>
            Visa kontrakt
          </Button>
        </div>
      </div>
    )
  }

  // Apply three-tier sorting
  const sortedLeases = sortLeasesByStatus(leases, rentalProperties)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontrakt</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveTable
          data={sortedLeases}
          columns={columns}
          keyExtractor={(lease) => lease.leaseId}
          emptyMessage="Inga kontrakt hittades"
          mobileCardRenderer={mobileCardRenderer}
        />
      </CardContent>
    </Card>
  )
}
