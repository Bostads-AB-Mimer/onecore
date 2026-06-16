import { GET } from './baseApi'
import type { components } from './generated/api-types'

export type CustomerMessage = components['schemas']['CustomerMessage']
export type DispatchWithRecipients =
  components['schemas']['DispatchWithRecipients']

export const communicationService = {
  // `kundId` is the tenant's contactCode (see core swagger path-param docs).
  async getCustomerMessages(contactCode: string): Promise<CustomerMessage[]> {
    const { data, error } = await GET(
      '/communication-log/customers/{kundId}/messages',
      {
        params: { path: { kundId: contactCode } },
      }
    )
    if (error) throw error
    return data.content ?? []
  },
}
