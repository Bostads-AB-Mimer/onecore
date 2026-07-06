import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'

import type { Tenant } from '@/services/types'

import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'

import { TenantContactActions } from './TenantContactActions'
import { TenantPersonalInfo } from './TenantPersonalInfo'

interface TenantCardProps {
  tenant: Tenant
  onSendSms?: (phoneNumber: string) => void
  onSendEmail?: (emailAddress: string) => void
}

export function TenantCard({
  tenant,
  onSendSms,
  onSendEmail,
}: TenantCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-medium text-lg">Hyresgäst</h3>
          <Button asChild variant="outline" size="sm">
            <Link to={paths.economy({ contactCode: tenant.contactCode })}>
              <Receipt className="h-4 w-4 mr-2" />
              Skapa ströfaktura
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
          <TenantPersonalInfo tenant={tenant} />
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
