import { GET, POST, PUT } from './baseApi'
import type { components } from './generated/api-types'

export type MessageTemplate = components['schemas']['MessageTemplate']
export type CreateMessageTemplate =
  components['schemas']['CreateMessageTemplate']
export type UpdateMessageTemplate =
  components['schemas']['UpdateMessageTemplate']
export type MessageTemplateStatusFilter = 'active' | 'archived' | 'all'

export const messageTemplateService = {
  /** Alphabetical. 'active' (default) hides archived templates. */
  async list(
    status: MessageTemplateStatusFilter = 'active'
  ): Promise<MessageTemplate[]> {
    const { data, error } = await GET('/message-templates', {
      params: { query: { status } },
    })
    if (error) throw error
    return data?.content ?? []
  },

  async create(body: CreateMessageTemplate): Promise<MessageTemplate> {
    const { data, error } = await POST('/message-templates', { body })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },

  async update(
    id: string,
    body: UpdateMessageTemplate
  ): Promise<MessageTemplate> {
    const { data, error } = await PUT('/message-templates/{id}', {
      params: { path: { id } },
      body,
    })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },

  async archive(id: string): Promise<MessageTemplate> {
    const { data, error } = await POST('/message-templates/{id}/archive', {
      params: { path: { id } },
    })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },

  async restore(id: string): Promise<MessageTemplate> {
    const { data, error } = await POST('/message-templates/{id}/restore', {
      params: { path: { id } },
    })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },
}
