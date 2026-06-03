import {
  ChannelLookupChannel,
  ChannelLookupResponse,
} from '@onecore/types/src/economy'
import { parseAsString, useQueryState } from 'nuqs'

import { useTenantAutogiroConsent } from '@/entities/tenant/hooks/useTenantAutogiroConsent'
import { useTenantInvoiceChannels } from '@/entities/tenant/hooks/useTenantInvoiceChannels'
import { useTenantInvoices } from '@/entities/tenant/hooks/useTenantInvoices'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'

import { InvoicesTable } from './InvoicesTable'

interface TenantLedgerTabContentProps {
  contactCode: string
  nationalRegistrationNumber: string
}

const InfoRow = ({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) => (
  <div className="flex justify-between py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}:</span>
    <span
      className={`text-sm font-medium ${highlight ? 'text-destructive' : ''}`}
    >
      {value}
    </span>
  </div>
)

const getInvoiceDeliveryMethod = (
  nationalRegistrationNumber: string,
  invoiceChannels: ChannelLookupResponse
) => {
  const methods: Record<ChannelLookupChannel, string> = {
    eInvoiceB2C: 'E-faktura',
    Kivra: 'Kivra',
  }

  let method = 'Pappersfaktura'

  if (invoiceChannels.length) {
    const foundChannel = invoiceChannels.find((channel) =>
      channel.matchedCandidates?.includes(nationalRegistrationNumber)
    )

    if (foundChannel) {
      method = methods[foundChannel.channel]
    }
  }

  return method
}

const PaymentInformation = ({
  nationalRegistrationNumber,
}: {
  nationalRegistrationNumber: string
}) => {
  const invoiceChannels = useTenantInvoiceChannels(nationalRegistrationNumber)
  const autogiroConsent = useTenantAutogiroConsent(nationalRegistrationNumber)

  const isLoading = invoiceChannels.isLoading && autogiroConsent.isLoading

  return (
    <Card>
      <CardHeader>
        <CardTitle>Betalningsinformation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          invoiceChannels.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow
                label="Alternativ för avisering"
                value={
                  autogiroConsent.data
                    ? 'Autogiro'
                    : getInvoiceDeliveryMethod(
                        nationalRegistrationNumber,
                        invoiceChannels.data
                      )
                }
              />
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}

const InvoicesCard = ({ contactCode }: { contactCode: string }) => {
  const invoices = useTenantInvoices(contactCode)
  const [expandedInvoiceId, setExpandedInvoiceId] = useQueryState(
    'open',
    parseAsString
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fakturor</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          invoices.data && (
            <InvoicesTable
              onInvoiceRowClick={setExpandedInvoiceId}
              expandedInvoiceId={expandedInvoiceId}
              invoices={invoices.data}
            />
          )
        )}
      </CardContent>
    </Card>
  )
}

export const TenantLedgerTabContent = ({
  contactCode,
  nationalRegistrationNumber,
}: TenantLedgerTabContentProps) => {
  return (
    <div className="space-y-6">
      <PaymentInformation
        nationalRegistrationNumber={nationalRegistrationNumber}
      />
      <InvoicesCard contactCode={contactCode} />
    </div>
  )
}
