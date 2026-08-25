import type { RelatedContact, Tenant } from '@/services/types'

import { Card, CardContent } from '@/shared/ui/Card'

import { getContactRoleTitle } from '../lib/relations'
import { TenantContactActions } from './TenantContactActions'
import { TenantPersonalInfo } from './TenantPersonalInfo'

interface TenantCardProps {
  tenant: Tenant
  relatedContacts: RelatedContact[]
  onSendSms?: (phoneNumber: string) => void
  onSendEmail?: (emailAddress: string) => void
}

export function TenantCard({
  tenant,
  relatedContacts,
  onSendSms,
  onSendEmail,
}: TenantCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-medium text-lg mb-6">
          {getContactRoleTitle(tenant, relatedContacts)}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
          <TenantPersonalInfo
            tenant={tenant}
            relatedContacts={relatedContacts}
          />
          <TenantContactActions
            phoneNumbers={tenant.phoneNumbers}
            email={tenant.emailAddress || undefined}
            onSendSms={onSendSms}
            onSendEmail={onSendEmail}
          />
        </div>
      </CardContent>
    </Card>
  )
}
