import { Contact } from '@onecore/types'
import type { SyncContactToEconomyUndo } from '@onecore/types'
import {
  addCustomer,
  getCustomer,
  updateCustomer,
  XledgerCustomerData,
} from '../common/adapters/xledger-adapter'

export type SyncCustomerPayload = Omit<
  Pick<Contact, 'contactCode' | 'fullName' | 'address' | 'emailAddress'>,
  'address'
> & {
  address?: Omit<NonNullable<Contact['address']>, 'number'>
}

const transformToXledgerCustomerPayload = (
  payload: SyncCustomerPayload
): XledgerCustomerData => ({
  contactCode: payload.contactCode,
  fullName: payload.fullName,
  address: {
    street: payload.address?.street || '',
    postalCode: payload.address?.postalCode || '',
    city: payload.address?.city || '',
  },
  emailAddress: payload.emailAddress,
})

const toPrevious = (customer: any): SyncContactToEconomyUndo['previous'] => ({
  fullName: customer.description ?? '',
  street: customer.address?.streetAddress ?? null,
  zipCode: customer.address?.zipCode ?? null,
  city: customer.address?.place ?? null,
  emailAddress: customer.email ?? null,
})

export const syncCustomer = async (
  customerPayload: SyncCustomerPayload,
  create?: boolean
): Promise<{
  customer: any
  previous: SyncContactToEconomyUndo['previous'] | null
} | null> => {
  const existing = await getCustomer(customerPayload.contactCode)
  if (!existing) {
    if (!create) return null
    const customer = await addCustomer(
      transformToXledgerCustomerPayload(customerPayload)
    )
    return { customer, previous: null }
  }

  const customer = await updateCustomer(
    existing,
    transformToXledgerCustomerPayload(customerPayload)
  )
  return { customer, previous: toPrevious(existing) }
}
