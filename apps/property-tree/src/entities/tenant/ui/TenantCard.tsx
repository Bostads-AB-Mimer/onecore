import { Card, CardContent } from '@/components/ui/v2/Card'
import { TenantContactActions } from './TenantContactActions'
import { TenantPersonalInfo } from './TenantPersonalInfo'
import type { Tenant } from '@/services/types'

interface TenantCardProps {
  tenant: Tenant
}

export function TenantCard({ tenant }: TenantCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-medium text-lg mb-6">Hyresgäst</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
          <TenantPersonalInfo tenant={tenant} />
          <TenantContactActions
            phoneNumbers={tenant.phoneNumbers}
            email={tenant.emailAddress || undefined}
          />
        </div>
      </CardContent>
    </Card>
  )
}
