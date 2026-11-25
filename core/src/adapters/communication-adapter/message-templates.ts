import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { client, mapFetchError, upstreamError } from './helpers'

type Template = communication.Template

// `err` is the upstream code when the service sent one (TEMPLATE_NAME_TAKEN,
// TEMPLATE_NOT_FOUND, ...) and the generic CommonErr otherwise, so core can
// forward it verbatim. statusCode is kept, unlike helpers' ProxiedAdapterResult,
// because the routes pass 404/409 straight through.
export type TemplateResult<T> =
  { ok: true; data: T } | { ok: false; err: string; statusCode: number }

const fail = (
  response: { status: number },
  error: unknown
): { ok: false; err: string; statusCode: number } => ({
  ok: false,
  err: upstreamError(error)?.error ?? mapFetchError(response),
  statusCode: response.status,
})

const unknownFailure = (
  err: unknown,
  what: string
): { ok: false; err: string; statusCode: number } => {
  logger.error({ err }, `communication-adapter: ${what} failed`)
  return { ok: false, err: 'unknown', statusCode: 500 }
}

const parseTemplate = (data: unknown): Template =>
  communication.TemplateSchema.parse(data)

export const listTemplates = async (
  status: communication.TemplateStatusFilter
): Promise<TemplateResult<Template[]>> => {
  try {
    const { data, error, response } = await client.GET('/message-templates', {
      params: { query: { status } },
    })
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: communication.TemplateSchema.array().parse(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'GET /message-templates')
  }
}

export const getTemplate = async (
  id: string
): Promise<TemplateResult<Template>> => {
  try {
    const { data, error, response } = await client.GET(
      '/message-templates/{id}',
      { params: { path: { id } } }
    )
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'GET /message-templates/{id}')
  }
}

export const createTemplate = async (
  body: communication.CreateTemplate
): Promise<TemplateResult<Template>> => {
  try {
    const { data, error, response } = await client.POST('/message-templates', {
      body,
    })
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'POST /message-templates')
  }
}

export const updateTemplate = async (
  id: string,
  body: communication.UpdateTemplate
): Promise<TemplateResult<Template>> => {
  try {
    const { data, error, response } = await client.PUT(
      '/message-templates/{id}',
      { params: { path: { id } }, body }
    )
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'PUT /message-templates/{id}')
  }
}

export const archiveTemplate = async (
  id: string
): Promise<TemplateResult<Template>> => {
  try {
    const { data, error, response } = await client.POST(
      '/message-templates/{id}/archive',
      { params: { path: { id } } }
    )
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'POST /message-templates/{id}/archive')
  }
}

export const restoreTemplate = async (
  id: string
): Promise<TemplateResult<Template>> => {
  try {
    const { data, error, response } = await client.POST(
      '/message-templates/{id}/restore',
      { params: { path: { id } } }
    )
    if (error || !response.ok) return fail(response, error)
    return { ok: true, data: parseTemplate(data) }
  } catch (err: unknown) {
    return unknownFailure(err, 'POST /message-templates/{id}/restore')
  }
}
