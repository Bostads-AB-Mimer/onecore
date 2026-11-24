import { logger } from '@onecore/utilities'
import { economy, SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'

import * as economyAdapter from '../../adapters/economy-adapter'
import { AdapterResult } from '../../adapters/types'
import { tenantAwareContactLookup } from '../../processes/contacts/protected-tenants'
import * as syncInvoiceRecipient from '../../processes/contacts/sync-invoice-recipient'
import type { ContactLookup } from '../../processes/contacts/sync-invoice-recipient'
import { errorLogFields } from '../../utils/error-log'

export const submitMiscellaneousInvoiceCreatingCustomer = async (
  invoice: economy.MiscellaneousInvoicePayload,
  attachment: unknown,
  deps: { contacts: ContactLookup } = { contacts: tenantAwareContactLookup }
): Promise<
  AdapterResult<
    Array<{ node: { dbId: number } }>,
    SubmitMiscellaneousInvoiceErrorCodes
  >
> => {
  const first = await economyAdapter.submitMiscellaneousInvoice(
    invoice,
    attachment
  )
  if (
    first.ok ||
    first.err !== SubmitMiscellaneousInvoiceErrorCodes.XledgerCustomerNotFound
  ) {
    return first
  }

  const { contactCode } = invoice
  const created = await syncInvoiceRecipient
    .syncInvoiceRecipientToEconomy(deps.contacts, contactCode)
    .catch((err: unknown) => {
      logger.error(
        { contactCode, ...errorLogFields(err) },
        'submitMiscellaneousInvoiceCreatingCustomer.syncThrew'
      )
      return { ok: false as const, err: 'sync-failed' as const }
    })
  if (!created.ok) {
    return {
      ok: false,
      err: SubmitMiscellaneousInvoiceErrorCodes.CustomerCreationFailed,
      detail: created.err,
    }
  }

  logger.info(
    { contactCode },
    'submitMiscellaneousInvoiceCreatingCustomer.customerCreated'
  )

  const second = await economyAdapter.submitMiscellaneousInvoice(
    invoice,
    attachment
  )
  if (
    !second.ok &&
    second.err === SubmitMiscellaneousInvoiceErrorCodes.XledgerCustomerNotFound
  ) {
    logger.error(
      { contactCode },
      'submitMiscellaneousInvoiceCreatingCustomer.customerNotFoundAfterCreate'
    )
    return {
      ok: false,
      err: SubmitMiscellaneousInvoiceErrorCodes.CustomerNotFoundAfterCreate,
    }
  }

  return second
}
