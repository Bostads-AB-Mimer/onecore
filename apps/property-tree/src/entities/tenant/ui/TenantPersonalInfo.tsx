import { MapPin } from 'lucide-react'

import type { Lease } from '@/services/api/core/leaseService'
import type { Tenant } from '@/services/types'
import { CopyableField } from '@/shared/ui/CopyableField'
import { TooltipProvider } from '@/shared/ui/Tooltip'

import { getTenantRoles, isOrganization } from '../lib/classification'
import { formatTenantAddress, formatTenantName } from '../lib/formatting'

type LeaseTenant = NonNullable<Lease['tenants']>[number]

interface TenantPersonalInfoProps {
  tenant: Tenant | LeaseTenant
  variant?: 'compact' | 'full'
}

export function TenantPersonalInfo({
  tenant,
  variant = 'full',
}: TenantPersonalInfoProps) {
  const displayName = formatTenantName(tenant)

  const handleOpenInMaps = (address: NonNullable<Tenant['address']>) => {
    const formattedAddress = formatTenantAddress(address)
    window.open(
      `https://maps.google.com/?q=${encodeURIComponent(formattedAddress)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <CopyableField label="Namn" value={displayName} />
        <CopyableField
          label={
            isOrganization(tenant) ? 'Organisationsnummer' : 'Personnummer'
          }
          value={tenant.nationalRegistrationNumber}
        />
        {variant === 'full' && tenant.address && (
          <CopyableField
            label="Bostadsadress"
            value={formatTenantAddress(tenant.address)}
            actions={[
              {
                icon: <MapPin className="h-4 w-4" />,
                onClick: () => handleOpenInMaps(tenant.address!),
                tooltip: 'Öppna i Google Maps',
                ariaLabel: 'Öppna adress i Google Maps',
              },
            ]}
          />
        )}
        {variant === 'full' && (
          <CopyableField label="Kundnummer" value={tenant.contactCode} />
        )}
        {variant === 'full' && (
          <CopyableField label="Typ/roll" value={getTenantRoles(tenant)} />
        )}
      </div>
    </TooltipProvider>
  )
}
