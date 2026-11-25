import { economy } from '@onecore/types'

// Strålfors routes an invoice to the first channel in this order that the
// recipient is registered in, falling back to paper. The lookup response lists
// available channels in no particular order, so we apply the priority here.
//
// ignoreError: Strålfors answers the B2C e-invoice lookup with an error instead
// of "not available" for everyone not registered for e-invoice (measured in
// prod Nov 2026, AVTAL-536). Tenfast ignores that error when it picks the
// channel and the invoice fee, so we do the same to show what the customer is
// billed for. Strålfors gives no error code, so every B2C error is ignored, a
// real outage included: a tenant with e-invoice then shows the next channel,
// just as Tenfast bills it. Set it back to false once Strålfors answers
// "not available" for these recipients.
const CHANNEL_PRIORITY: {
  channel: string
  label: string
  ignoreError: boolean
}[] = [
  { channel: 'eInvoiceB2C', label: 'E-faktura', ignoreError: true },
  { channel: 'eInvoiceB2B', label: 'E-faktura', ignoreError: false },
  { channel: 'Kivra', label: 'Kivra', ignoreError: false },
]

/**
 * Returns the label for how the tenant gets their invoices, or null when it
 * cannot be determined because a lookup it depends on failed.
 */
export const getInvoiceDeliveryMethod = ({
  invoiceChannels,
  hasAutogiroConsent,
}: {
  /** undefined when the channel lookup failed */
  invoiceChannels: economy.ChannelLookupResponse | undefined
  /** undefined when the autogiro consent request failed */
  hasAutogiroConsent: boolean | undefined
}): string | null => {
  if (hasAutogiroConsent) {
    return 'Autogiro'
  }

  // Autogiro overrides every channel, so without a consent answer or a
  // channel answer there is nothing reliable to show.
  if (hasAutogiroConsent === undefined || !invoiceChannels) {
    return null
  }

  const availableChannels =
    invoiceChannels.candidates[0]?.availableInChannels ?? []
  const failedChannels = (invoiceChannels.channelErrors ?? []).map(
    ({ channel }) => channel
  )

  for (const { channel, label, ignoreError } of CHANNEL_PRIORITY) {
    if (availableChannels.includes(channel)) {
      return label
    }

    // The lookup of a channel with higher priority than any available one
    // failed, so the tenant may be registered there without us knowing.
    if (!ignoreError && failedChannels.includes(channel)) {
      return null
    }
  }

  return 'Pappersfaktura'
}
