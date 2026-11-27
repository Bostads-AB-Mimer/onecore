import { communication } from '@onecore/types'

import { client } from './helpers'
import { fail, TemplateResult, unknownFailure } from './message-templates'

type SystemTemplate = communication.SystemTemplate

const parseSystemTemplate = (data: unknown): SystemTemplate =>
  communication.SystemTemplateSchema.parse(data)

export const listSystemTemplates = async (): Promise<
  TemplateResult<SystemTemplate[]>
> => {
  try {
    const { data, error, response } = await client.GET('/system-templates')
    if (error || !response.ok) return fail(response, error)
    return {
      ok: true,
      data: communication.SystemTemplateSchema.array().parse(data),
    }
  } catch (err: unknown) {
    return unknownFailure(err, 'GET /system-templates')
  }
}

export const getSystemTemplate = async (
  key: string
): Promise<TemplateResult<SystemTemplate>> => {
  try {
    const { data, error, response } = await client.GET(
      '/system-templates/{key}',
      { params: { path: { key } } }
    )
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseSystemTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'GET /system-templates/{key}')
  }
}

export const updateSystemTemplate = async (
  key: string,
  body: communication.UpdateSystemTemplateParams
): Promise<TemplateResult<SystemTemplate>> => {
  try {
    const { data, error, response } = await client.PUT(
      '/system-templates/{key}',
      { params: { path: { key } }, body }
    )
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseSystemTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'PUT /system-templates/{key}')
  }
}

export const previewSystemTemplate = async (
  key: string,
  body: communication.PreviewSystemTemplate
): Promise<TemplateResult<communication.SystemTemplatePreview>> => {
  try {
    const { data, error, response } = await client.POST(
      '/system-templates/{key}/preview',
      { params: { path: { key } }, body }
    )
    if (error || !response.ok) return fail(response, error)
    return {
      ok: true,
      data: communication.SystemTemplatePreviewSchema.parse(data),
    }
  } catch (err: unknown) {
    return unknownFailure(err, 'POST /system-templates/{key}/preview')
  }
}
