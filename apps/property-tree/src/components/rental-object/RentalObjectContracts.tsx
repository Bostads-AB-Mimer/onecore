import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import { Loader2 } from 'lucide-react'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import type { ReactNode } from 'react'
import {
  formatDate,
  getStatusBadge,
} from '@/components/tenants/lease-helpers.tsx'
import { useLeasesByRentalProperty } from '@/components/hooks/useLeasesByRentalProperty'
import type { Lease } from '@/services/api/core/lease-service'
import { Link } from 'react-router-dom'

interface RentalObjectContractsProps {
  rentalPropertyId: string
}

export function RentalObjectContracts({
  rentalPropertyId,
}: RentalObjectContractsProps) {
  const { data: leases, isLoading: isLoadingLeases } =
    useLeasesByRentalProperty(rentalPropertyId)

  // Show loading state while leases are being fetched
  if (isLoadingLeases) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kontrakt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Hämtar kontrakt...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show empty state if no leases
  if (!leases || leases.length === 0) {
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

  // Helper to render tenant names
  const renderTenantNames = (lease: Lease): ReactNode => {
    if (!lease.tenants || lease.tenants.length === 0) {
      return <span className="text-muted-foreground">Ingen hyresgäst</span>
    }

    return (
      <div className="space-y-1">
        {lease.tenants.map((tenant, index) => {
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
              {index === 0 && (
                <div className="text-sm text-muted-foreground">
                  {tenant.contactCode}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Helper to render contact info
  const renderContactInfo = (lease: Lease): ReactNode => {
    if (!lease.tenants || lease.tenants.length === 0) {
      return <span className="text-muted-foreground">-</span>
    }

    const primaryTenant = lease.tenants[0]
    const phone = primaryTenant.phoneNumbers?.find((p) => p.isMainNumber)

    return (
      <div className="space-y-1 text-sm">
        {primaryTenant.emailAddress && <div>{primaryTenant.emailAddress}</div>}
        {phone && <div>{phone.phoneNumber}</div>}
        {!primaryTenant.emailAddress && !phone && (
          <span className="text-muted-foreground">Ej tillgänglig</span>
        )}
      </div>
    )
  }

  // Helper to render status badge (handles both string and numeric status values)
  const renderStatusBadge = (status: Lease['status']): ReactNode => {
    // Try the existing helper first
    const badge = getStatusBadge(status)
    if (badge) return badge

    // Fallback: render status as text if badge is null
    return (
      <span className="text-sm text-muted-foreground">{String(status)}</span>
    )
  }

  // Define table columns
  const columns = [
    {
      key: 'leaseNumber',
      label: 'Kontraktsnummer',
      render: (lease: Lease) =>
        `${lease.rentalPropertyId}/${lease.leaseNumber}`,
    },
    {
      key: 'tenant',
      label: 'Hyresgäst',
      render: (lease: Lease) => renderTenantNames(lease),
    },
    {
      key: 'contact',
      label: 'Kontaktuppgifter',
      render: (lease: Lease) => renderContactInfo(lease),
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
      key: 'status',
      label: 'Status',
      render: (lease: Lease) => renderStatusBadge(lease.status),
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
    const hasTenants = lease.tenants && lease.tenants.length > 0
    const primaryTenant = hasTenants ? lease.tenants?.[0] : null
    const phone = primaryTenant?.phoneNumbers?.find((p) => p.isMainNumber)
    const isValidContact =
      primaryTenant?.contactCode.startsWith('P') ||
      primaryTenant?.contactCode.startsWith('F')

    return (
      <div className="space-y-3 w-full">
        {/* Header: Status Badge + Lease Number */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-medium">
              Kontrakt {lease.rentalPropertyId}/{lease.leaseNumber}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatDate(lease.leaseStartDate)}
              {lease.lastDebitDate && ` - ${formatDate(lease.lastDebitDate)}`}
            </div>
          </div>
          {renderStatusBadge(lease.status)}
        </div>

        {/* Tenant Info Section */}
        <div className="space-y-2 text-sm">
          {hasTenants ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hyresgäst:</span>
                {isValidContact ? (
                  <Link
                    to={`/tenants/${primaryTenant?.contactCode}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {primaryTenant?.fullName}
                  </Link>
                ) : (
                  <span className="font-medium">{primaryTenant?.fullName}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kundnummer:</span>
                <span>{primaryTenant?.contactCode}</span>
              </div>
              {primaryTenant?.emailAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-post:</span>
                  <span>{primaryTenant.emailAddress}</span>
                </div>
              )}
              {phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefon:</span>
                  <span>{phone.phoneNumber}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hyresgäst:</span>
              <span className="text-muted-foreground">Ingen hyresgäst</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" disabled>
            Visa kontrakt
          </Button>
        </div>
      </div>
    )
  }

  // Deduplicate leases by leaseId (in case API returns duplicates for multiple tenants)
  const uniqueLeases = leases
    ? Array.from(
        new Map(leases.map((lease) => [lease.leaseId, lease])).values()
      )
    : []

  // Sort leases by contract number (highest first)
  const sortedLeases = uniqueLeases.sort((a, b) => {
    return b.leaseNumber.localeCompare(a.leaseNumber)
  })

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
