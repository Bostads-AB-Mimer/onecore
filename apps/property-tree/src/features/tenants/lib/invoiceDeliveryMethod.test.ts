import { economy } from '@onecore/types'
import { describe, expect, it } from 'vitest'

import { getInvoiceDeliveryMethod } from './invoiceDeliveryMethod'

const channels = (
  availableInChannels: string[],
  failedChannels: string[] = []
): economy.ChannelLookupResponse => ({
  candidates: [
    {
      referenceId: '191212121212',
      availableInChannels,
      notAvailableInChannels: [],
    },
  ],
  channelErrors: failedChannels.map((channel) => ({
    channel,
    error: 'lookup failed',
  })),
})

describe('getInvoiceDeliveryMethod', () => {
  it('prefers e-invoice over Kivra regardless of the order Strålfors lists them', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['Kivra', 'eInvoiceB2C']),
        hasAutogiroConsent: false,
      })
    ).toBe('E-faktura')
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['Kivra', 'eInvoiceB2B']),
        hasAutogiroConsent: false,
      })
    ).toBe('E-faktura')
  })

  it('returns Kivra when Kivra is the only digital channel', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['Kivra']),
        hasAutogiroConsent: false,
      })
    ).toBe('Kivra')
  })

  it('falls back to paper when no known digital channel is available', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels([]),
        hasAutogiroConsent: false,
      })
    ).toBe('Pappersfaktura')
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['somethingElse']),
        hasAutogiroConsent: false,
      })
    ).toBe('Pappersfaktura')
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: { candidates: [], channelErrors: [] },
        hasAutogiroConsent: false,
      })
    ).toBe('Pappersfaktura')
  })

  it('returns Autogiro when there is an autogiro consent, whatever the channels', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['Kivra', 'eInvoiceB2C']),
        hasAutogiroConsent: true,
      })
    ).toBe('Autogiro')
  })

  it('returns Autogiro for a consent even when the channel lookup failed', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: undefined,
        hasAutogiroConsent: true,
      })
    ).toBe('Autogiro')
  })

  it('returns null when the autogiro consent request failed', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['eInvoiceB2C']),
        hasAutogiroConsent: undefined,
      })
    ).toBeNull()
  })

  it('returns null when the channel lookup failed and there is no consent', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: undefined,
        hasAutogiroConsent: false,
      })
    ).toBeNull()
  })

  it('returns null when a channel with higher priority than the available one failed', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['Kivra'], ['eInvoiceB2B']),
        hasAutogiroConsent: false,
      })
    ).toBeNull()
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels([], ['Kivra']),
        hasAutogiroConsent: false,
      })
    ).toBeNull()
  })

  // Strålfors answers the B2C e-invoice lookup with an error for everyone not
  // registered for e-invoice, and Tenfast bills by the remaining channels.
  // There is no error code to tell that apart from an outage, so any B2C
  // error is ignored.
  it('ignores a failed B2C e-invoice lookup, whatever the error', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['Kivra'], ['eInvoiceB2C']),
        hasAutogiroConsent: false,
      })
    ).toBe('Kivra')
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels([], ['eInvoiceB2C']),
        hasAutogiroConsent: false,
      })
    ).toBe('Pappersfaktura')
  })

  it('still returns null when Kivra failed alongside the B2C e-invoice lookup', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels([], ['eInvoiceB2C', 'Kivra']),
        hasAutogiroConsent: false,
      })
    ).toBeNull()
  })

  it('ignores a failed channel with lower priority than the available one', () => {
    expect(
      getInvoiceDeliveryMethod({
        invoiceChannels: channels(['eInvoiceB2C'], ['Kivra']),
        hasAutogiroConsent: false,
      })
    ).toBe('E-faktura')
  })
})
