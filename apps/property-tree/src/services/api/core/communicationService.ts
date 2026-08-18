import { GET } from './baseApi'
import type { components } from './generated/api-types'

export type CustomerMessage = components['schemas']['CustomerMessage']
export type DispatchWithRecipients =
  components['schemas']['DispatchWithRecipients']

export const communicationService = {
  async getCustomerMessages(contactCode: string): Promise<CustomerMessage[]> {
    const { data, error } = await GET(
      '/communication-log/customers/{contactCode}/messages',
      {
        params: { path: { contactCode } },
      }
    )
    if (error) throw error
    return data.content ?? []
  },
}
