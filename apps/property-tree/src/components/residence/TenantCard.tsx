import { Users, User } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/v2/Button'
import { TenantPersonalInfo } from './TenantPersonalInfo'
import { TenantContactActions } from './TenantContactActions'
import { components } from '@/services/api/core/generated/api-types'

type Tenant = NonNullable<components['schemas']['Lease']['tenants']>[number]
type Lease = components['schemas']['Lease']

type Props = { lease: Lease; tenant: Tenant }

export function TenantCard(props: Props) {
  const phone = props.tenant.phoneNumbers?.find((v) => v.isMainNumber)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="h-5 w-5 mr-2 text-slate-500" />
          <h4 className="font-medium">Hyresgäst</h4>
        </div>
        <Button variant="outline" asChild className="shrink-0" disabled>
          <Link
            to={`/tenants/detail/${props.tenant.nationalRegistrationNumber}`}
          >
            <User className="h-4 w-4 mr-2" />
            Öppna kundkort
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <TenantPersonalInfo
          firstName={props.tenant.firstName}
          lastName={props.tenant.lastName}
          moveInDate={props.lease.leaseStartDate}
          moveOutDate={props.lease.preferredMoveOutDate}
          personalNumber={props.tenant.nationalRegistrationNumber}
        />
        <TenantContactActions
          phone={phone?.phoneNumber || 'N/A'}
          email={props.tenant.emailAddress || 'N/A'}
        />
      </div>
    </div>
  )
}
