import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { formatDate, LeaseMobileCard, LeaseStatusBadge } from '@/entities/lease'

import type { Lease } from '@/services/api/core/leaseService'

import { paths } from '@/shared/routes'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

import { useLeasesByRentalProperty } from '../hooks/useLeasesByRentalProperty'

interface LeasesTabContentProps {
  rentalPropertyId: string
}

export function LeasesTabContent({ rentalPropertyId }: LeasesTabContentProps) {
  const { data: leases, isLoading: isLoadingLeases } =
    useLeasesByRentalProperty(rentalPropertyId)

  // Show loading state while leases are being fetched
  if (isLoadingLeases) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Hämtar kontrakt...</span>
      </div>
    )
  }

  // Show empty state if no leases
  if (!leases || leases.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Inga kontrakt hittades
      </p>
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
                  to={paths.tenant(tenant.contactCode)}
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
      render: (lease: Lease) => <LeaseStatusBadge status={lease.status} />,
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
      <LeaseMobileCard
        lease={lease}
        title={`Kontrakt ${lease.rentalPropertyId}/${lease.leaseNumber}`}
      >
        <div className="space-y-2 text-sm">
          {hasTenants ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hyresgäst:</span>
                {isValidContact ? (
                  <Link
                    to={paths.tenant(primaryTenant?.contactCode ?? '')}
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
      </LeaseMobileCard>
    )
  }

  // Sort leases by contract number (highest first)
  const sortedLeases = [...leases].sort((a, b) => {
    return b.leaseNumber.localeCompare(a.leaseNumber)
  })

  return (
    <TabLayout title="Kontrakt" showCard={true} showHeader={true}>
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
