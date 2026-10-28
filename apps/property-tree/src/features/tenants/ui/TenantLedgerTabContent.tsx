import { Link } from 'react-router-dom'
import { economy } from '@onecore/types'
import { Receipt } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'

import { useTenantAutogiroConsent } from '@/entities/tenant/hooks/useTenantAutogiroConsent'
import { useTenantInvoiceChannels } from '@/entities/tenant/hooks/useTenantInvoiceChannels'
import { useTenantInvoices } from '@/entities/tenant/hooks/useTenantInvoices'

import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { Skeleton } from '@/shared/ui/Skeleton'
import TableSkeleton from '@/shared/ui/TableSkeleton'

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

const CHANNEL_LABELS: Record<string, string> = {
  eInvoiceB2C: 'E-faktura',
  eInvoiceB2B: 'E-faktura',
  Kivra: 'Kivra',
}

const getInvoiceDeliveryMethod = (
  invoiceChannels: economy.ChannelLookupResponse
) => {
  const availableChannel =
    invoiceChannels.candidates[0]?.availableInChannels.find(
      (channel) => channel in CHANNEL_LABELS
    )

  return availableChannel ? CHANNEL_LABELS[availableChannel] : 'Pappersfaktura'
}

const PaymentInformation = ({
  nationalRegistrationNumber,
  isIndividual,
}: {
  nationalRegistrationNumber: string
  isIndividual: boolean
}) => {
  const invoiceChannels = useTenantInvoiceChannels({
    recipientId: nationalRegistrationNumber,
    recipientType: isIndividual ? 'individual' : 'organization',
  })
  const autogiroConsent = useTenantAutogiroConsent(nationalRegistrationNumber)

  const isLoading = invoiceChannels.isLoading || autogiroConsent.isLoading

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
                    : getInvoiceDeliveryMethod(invoiceChannels.data)
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
    <TabLayout title="Fakturor" showCard={true}>
      <Button asChild variant="outline" size="sm">
        <Link to={paths.economy({ contactCode })}>
          <Receipt className="h-4 w-4 mr-2" />
          Skapa ströfaktura
        </Link>
      </Button>
      {invoices.isLoading ? (
        <TableSkeleton />
      ) : (
        invoices.data && (
          <InvoicesTable
            onInvoiceRowClick={setExpandedInvoiceId}
            expandedInvoiceId={expandedInvoiceId}
            invoices={invoices.data}
            contactCode={contactCode}
          />
        )
      )}
    </TabLayout>
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
        // TODO Resolving contact type like this is good enough for now, but should ideally
        // use Contact type from contacts service instead of Tenant type from leasing service
        isIndividual={contactCode.startsWith('P')}
      />
      <InvoicesCard contactCode={contactCode} />
    </div>
  )
}
