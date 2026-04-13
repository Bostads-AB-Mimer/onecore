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
                    sms.openSmsModal(formatTenantName(tenant), phone)
                  }
                  onSendEmail={(addr) =>
                    email.openEmailModal(formatTenantName(tenant), addr)
                  }
                />
              </>
            ))}
          </div>
          <SmsModal
            open={sms.smsModalOpen}
            onOpenChange={sms.onOpenChange}
            recipientName={sms.smsRecipientName}
            phoneNumber={sms.smsPhoneNumber}
            onSend={sms.handleSendSms}
          />
          <EmailModal
            open={email.emailModalOpen}
            onOpenChange={email.onOpenChange}
            recipientName={email.emailRecipientName}
            emailAddress={email.emailAddress}
            onSend={email.handleSendEmail}
          />
        </>
      )}
    </TabLayout>
  )
}
