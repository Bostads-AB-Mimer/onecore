import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/Tooltip'
import { InfoIcon } from 'lucide-react'
import { Lease } from '@/services/api/core/leaseService'
import type { RentalPropertyInfo } from '@onecore/types'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import type { ReactNode } from 'react'
import {
  formatRentalType,
  formatDate,
  formatAddress,
  getPropertyIdentifier,
  sortLeasesByStatus,
  LeaseMobileCard,
  LeaseStatusBadge,
} from '@/entities/lease'

interface TenantLeasesTabContentProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  isLoadingLeases?: boolean
  isLoadingProperties?: boolean
}

export function TenantLeasesTabContent({
  leases,
  rentalProperties,
  isLoadingLeases = false,
  isLoadingProperties = false,
}: TenantLeasesTabContentProps) {
  const isLoading = isLoadingLeases || isLoadingProperties

  // Show empty state if no leases
  if (!isLoading && !leases.length) {
    return (
      <TabLayout title="Kontrakt" showCard={true}>
        <p className="text-muted-foreground text-center py-8">
          Inga kontrakt hittades
        </p>
      </TabLayout>
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
      label: 'Lägenhetsnummer/Skyltnummer',
      render: (lease: Lease) =>
        renderPropertyField(
          lease,
          (property) => getPropertyIdentifier(property),
          'Data ej tillgänglig'
        ),
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
      render: (lease: Lease) => <LeaseStatusBadge status={lease.status} />,
    },
  ]

  // Mobile card renderer
  const mobileCardRenderer = (lease: Lease) => {
    const property = rentalProperties[lease.rentalPropertyId]
    const isMissing = !property

    return (
      <LeaseMobileCard lease={lease}>
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
      </LeaseMobileCard>
    )
  }

  // Apply three-tier sorting
  const sortedLeases = sortLeasesByStatus(leases, rentalProperties)

  return (
    <TabLayout title="Kontrakt" showCard={true} isLoading={isLoading}>
      <ResponsiveTable
        data={sortedLeases}
        columns={columns}
        keyExtractor={(lease) => lease.leaseId}
        emptyMessage="Inga kontrakt hittades"
        mobileCardRenderer={mobileCardRenderer}
      />
    </TabLayout>
  )
}
