import { GET, POST } from './baseApi'
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

  /** Cancel a scheduled dispatch (idempotent; 409 if it already fired). */
  async cancelDispatch(
    dispatchId: string
  ): Promise<{ dispatchId?: string; cancelledRecipients?: number }> {
    const { data, error } = await POST(
      '/communication-log/dispatches/{id}/cancel',
      {
        params: { path: { id: dispatchId } },
      }
    )
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },

  /** Move a scheduled dispatch to a new send time (ISO instant). */
  async rescheduleDispatch(
    dispatchId: string,
    sendAt: string
  ): Promise<{ dispatchId?: string; sendAt?: string }> {
    const { data, error } = await POST(
      '/communication-log/dispatches/{id}/reschedule',
      {
        params: { path: { id: dispatchId } },
        body: { sendAt },
      }
    )
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },
}
