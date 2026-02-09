import { Users, User } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/v2/Button'
import { TenantPersonalInfo, TenantContactActions } from '@/entities/tenant'
import type { Lease } from '@/services/api/core/lease-service'

type LeaseTenant = NonNullable<Lease['tenants']>[number]

type TenantLeaseCardProps = { tenant: LeaseTenant }

export function TenantLeaseCard({ tenant }: TenantLeaseCardProps) {
  const phone = tenant.phoneNumbers?.find(
    (v: { isMainNumber: boolean }) => v.isMainNumber
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="h-5 w-5 mr-2 text-slate-500" />
          <h4 className="font-medium">Kontraktsinnehavare</h4>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link to={`/tenants/${tenant.contactCode}`} rel="noopener noreferrer">
            <User className="h-4 w-4 mr-2" />
            Öppna kundkort
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <TenantPersonalInfo tenant={tenant} variant="compact" />
        <TenantContactActions
          phoneNumbers={phone ? [phone] : undefined}
          email={tenant.emailAddress || undefined}
        />
      </div>
    </div>
  )
}
