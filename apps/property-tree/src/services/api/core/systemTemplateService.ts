import { GET, POST, PUT } from './baseApi'
import type { components } from './generated/api-types'

export type SystemTemplate = components['schemas']['SystemTemplate']
export type SystemTemplateKey = SystemTemplate['key']
export type TemplatePlaceholder = SystemTemplate['placeholders'][number]
export type UpdateSystemTemplate = components['schemas']['UpdateSystemTemplate']
export type PreviewSystemTemplate =
  components['schemas']['PreviewSystemTemplate']
export type SystemTemplatePreview =
  components['schemas']['SystemTemplatePreview']
export type SystemTemplateCapabilities =
  components['schemas']['SystemTemplateCapabilities']

export const systemTemplateService = {
  /** Alphabetical; capabilities.canEdit says whether the caller may edit. */
  async list(): Promise<{
    templates: SystemTemplate[]
    capabilities: SystemTemplateCapabilities
  }> {
    const { data, error } = await GET('/system-templates')
    if (error) throw error
    if (!data) throw new Error('Response ok but missing content')
    return { templates: data.content, capabilities: data.capabilities }
  },

  async get(key: SystemTemplateKey): Promise<SystemTemplate> {
    const { data, error } = await GET('/system-templates/{key}', {
      params: { path: { key } },
    })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },

  async update(
    key: SystemTemplateKey,
    body: UpdateSystemTemplate
  ): Promise<SystemTemplate> {
    const { data, error } = await PUT('/system-templates/{key}', {
      params: { path: { key } },
      body,
    })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },

  /** The finished email (layout and footer) with example values. */
  async preview(
    key: SystemTemplateKey,
    body: PreviewSystemTemplate
  ): Promise<SystemTemplatePreview> {
    const { data, error } = await POST('/system-templates/{key}/preview', {
      params: { path: { key } },
      body,
    })
    if (error) throw error
    if (!data?.content) throw new Error('Response ok but missing content')
    return data.content
  },
}
