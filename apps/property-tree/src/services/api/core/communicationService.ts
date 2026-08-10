import { GET, POST } from './baseApi'
import type { components, paths } from './generated/api-types'

export type CustomerMessage = components['schemas']['CustomerMessage']
export type DispatchWithRecipients =
  components['schemas']['DispatchWithRecipients']
export type DispatchListItem = components['schemas']['DispatchListItem']
export type MessageRecipient = components['schemas']['MessageRecipient']
export type PaginationMeta = components['schemas']['PaginationMeta']
export type PaginationLinks = components['schemas']['PaginationLinks']

export type PaginatedResponse<T> = {
  content: T[]
  _meta: PaginationMeta
  _links: PaginationLinks[]
}

// Derived from generated types — single source of truth
type DispatchSearchQuery = NonNullable<
  paths['/communication-log/dispatches']['get']['parameters']['query']
>
export type DispatchSearchQueryParams = Omit<
  DispatchSearchQuery,
  'page' | 'limit'
>

type RecipientsQuery = NonNullable<
  paths['/communication-log/dispatches/{id}/recipients']['get']['parameters']['query']
>
export type DispatchRecipientsQueryParams = Omit<
  RecipientsQuery,
  'page' | 'limit'
>

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

  /** Paginated dispatch search for the dispatch centre overview. */
  async searchDispatches(
    params: DispatchSearchQueryParams,
    page = 1,
    limit = 25
  ): Promise<PaginatedResponse<DispatchListItem>> {
    const { data, error } = await GET('/communication-log/dispatches', {
      params: { query: { ...params, page, limit } },
    })
    if (error) throw error
    return data
  },

  /** Paginated recipients of a single dispatch (for the detail view). */
  async getDispatchRecipients(
    id: string,
    params: DispatchRecipientsQueryParams = {},
    page = 1,
    limit = 25
  ): Promise<PaginatedResponse<MessageRecipient>> {
    const { data, error } = await GET(
      '/communication-log/dispatches/{id}/recipients',
      {
        params: { path: { id }, query: { ...params, page, limit } },
      }
    )
    if (error) throw error
    return data
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
