import { LeaseInfo } from '@/entities/lease'
import { TenantLeaseCard, formatTenantName } from '@/entities/tenant'

import { Lease } from '@/services/api/core/leaseService'
import { tenantService } from '@/services/api/core/tenantService'

import { useSingleEmail, useSingleSms } from '@/shared/hooks'
import { EmailModal } from '@/shared/ui/EmailModal'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { Separator } from '@/shared/ui/Separator'
import { SmsModal } from '@/shared/ui/SmsModal'

interface TenantsTabContentProps {
  isLoading: boolean
  error: Error | null
  lease: Lease | undefined
}

export function TenantsTabContent({
  isLoading,
  error,
  lease,
}: TenantsTabContentProps) {
  const sms = useSingleSms({ sendSms: tenantService.sendBulkSms })
  const email = useSingleEmail({ sendEmail: tenantService.sendBulkEmail })

  // Empty state when no lease
  if (!isLoading && !error && !lease) {
    return (
      <TabLayout title="Hyresgäst" showCard={true}>
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Ingen nuvarande kontraktsinnehavare
          </h2>
        </div>
      </TabLayout>
    )
  }

  return (
    <TabLayout
      title="Hyresgäst"
      showCard={true}
      isLoading={isLoading}
      error={error}
      errorMessage="Kontrakt hittades inte"
    >
      {lease && (
        <>
          <LeaseInfo lease={lease} />
          <div className="space-y-6">
            {lease.tenants?.map((tenant, i) => (
              <>
                {i > 0 && <Separator />}
                <TenantLeaseCard
                  tenant={tenant}
                  key={i}
                  onSendSms={(phone) =>
                    sms.openSmsModal({
                      name: formatTenantName(tenant),
                      phoneNumber: phone,
                      contactCode: tenant.contactCode,
                    })
                  }
                  onSendEmail={(addr) =>
                    email.openEmailModal({
                      name: formatTenantName(tenant),
                      emailAddress: addr,
                      contactCode: tenant.contactCode,
                    })
                  }
                />
              </>
            ))}
          </div>
          {sms.recipient && (
            <SmsModal
              open
              onOpenChange={(open) => {
                if (!open) sms.closeSms()
              }}
              recipientName={sms.recipient.name}
              phoneNumber={sms.recipient.phoneNumber}
              onSend={sms.handleSendSms}
            />
          )}
          {email.recipient && (
            <EmailModal
              open
              onOpenChange={(open) => {
                if (!open) email.closeEmail()
              }}
              recipientName={email.recipient.name}
              emailAddress={email.recipient.emailAddress}
              onSend={email.handleSendEmail}
            />
          )}
        </>
      )}
    </TabLayout>
  )
}
