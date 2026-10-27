import { Contact } from '@onecore/types'
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

export const syncCustomer = async (
  customerPayload: SyncCustomerPayload,
  create?: boolean
): Promise<any> => {
  let xledgerCustomer = await getCustomer(customerPayload.contactCode)
  if (!xledgerCustomer) {
    if (create) {
      xledgerCustomer = await addCustomer(
        transformToXledgerCustomerPayload(customerPayload)
      )
    } else {
      return null
    }
  } else {
    xledgerCustomer = await updateCustomer(
      xledgerCustomer,
      transformToXledgerCustomerPayload(customerPayload)
    )
  }

  return xledgerCustomer
}
