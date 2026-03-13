import type { Lease } from '@/services/api/core/leaseService'
import type { Tenant } from '@/services/types'

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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Namn</p>
        <p className="font-medium">{displayName}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">
          {isOrganization(tenant) ? 'Organisationsnummer' : 'Personnummer'}
        </p>
        <p className="font-medium">{tenant.nationalRegistrationNumber}</p>
      </div>
      {variant === 'full' && tenant.address && (
        <div>
          <p className="text-sm text-muted-foreground">Bostadsadress</p>
          <p className="font-medium">{formatTenantAddress(tenant.address)}</p>
        </div>
      )}
      {variant === 'full' && (
        <div>
          <p className="text-sm text-muted-foreground">Kundnummer</p>
          <p className="font-medium">{tenant.contactCode}</p>
        </div>
      )}
      {variant === 'full' && (
        <div>
          <p className="text-sm text-muted-foreground">Typ/roll</p>
          <p className="font-medium">{getTenantRoles(tenant)}</p>
        </div>
      )}
    </div>
  )
}
