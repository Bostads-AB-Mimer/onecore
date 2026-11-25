import { economy } from '@onecore/types'

// Strålfors routes an invoice to the first channel in this order that the
// recipient is registered in, falling back to paper. The lookup response lists
// available channels in no particular order, so we apply the priority here.
const CHANNEL_PRIORITY: { channel: string; label: string }[] = [
  { channel: 'eInvoiceB2C', label: 'E-faktura' },
  { channel: 'eInvoiceB2B', label: 'E-faktura' },
  { channel: 'Kivra', label: 'Kivra' },
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

  for (const { channel, label } of CHANNEL_PRIORITY) {
    if (availableChannels.includes(channel)) {
      return label
    }

    // The lookup of a channel with higher priority than any available one
    // failed, so the tenant may be registered there without us knowing.
    if (failedChannels.includes(channel)) {
      return null
    }
  }

  return 'Pappersfaktura'
}
