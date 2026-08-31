import { Link } from 'react-router-dom'
import { User, Users } from 'lucide-react'

import { TenantContactActions, TenantPersonalInfo } from '@/entities/tenant'

import type { Lease } from '@/services/api/core/leaseService'

import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'

type LeaseTenant = NonNullable<Lease['tenants']>[number]

type TenantLeaseCardProps = {
  tenant: LeaseTenant
  onSendSms?: (phoneNumber: string) => void
  onSendEmail?: (emailAddress: string) => void
}

export function TenantLeaseCard({
  tenant,
  onSendSms,
  onSendEmail,
}: TenantLeaseCardProps) {
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
          <Link to={paths.tenant(tenant.contactCode)} rel="noopener noreferrer">
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
          onSendSms={onSendSms}
          onSendEmail={onSendEmail}
        />
      </div>
    </div>
  )
}
