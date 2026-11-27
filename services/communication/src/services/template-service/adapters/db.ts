import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'
import type { Knex } from 'knex'

import { db } from '../../../common/db'
import { markdownToText } from '../render/render'
import {
  SystemTemplate,
  SystemTemplateKey,
  SystemTemplateLookupError,
  SystemTemplateNotFoundError,
} from '../system-templates'

type Template = communication.Template
type CreateTemplateParams = communication.CreateTemplateParams
type UpdateTemplateParams = communication.UpdateTemplateParams
type UpdateSystemTemplateParams = communication.UpdateSystemTemplateParams
type TemplateStatusFilter = communication.TemplateStatusFilter

const TABLE = 'template'

// Raw row: channels/categories are comma-separated NVARCHAR columns. A row
// with a systemKey is a system template; the rep-route queries below skip
// them with .whereNull('systemKey').
export type TemplateRow = Omit<
  Template,
  'channels' | 'categories' | 'smsText'
> & {
  channels: string
  categories: string | null
  systemKey?: string | null // optional: tests build rows without it
}

// A system template as stored; the routes add the editor's extras.
export type SystemTemplateRecord = {
  key: SystemTemplateKey
  name: string
  channels: communication.Channel[]
  subject: string
  body: string
  revision: number
  updatedBy: string | null
  updatedAt: Date
}

// An optimistic update either lands or says why not. 'conflict' means the
// row exists but someone saved after the caller loaded it.
export type UpdateResult<T> =
  { ok: true; template: T } | { ok: false; reason: 'not-found' | 'conflict' }

const splitList = (value: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : []

// The column holds channel names only; the enum parse guards against drift.
const parseChannels = (value: string) =>
  communication.TemplateSchema.shape.channels.parse(splitList(value))

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- drop systemKey from the API shape
export const toTemplate = ({ systemKey, ...row }: TemplateRow): Template => ({
  ...row,
  channels: parseChannels(row.channels),
  categories: splitList(row.categories),
  smsText: markdownToText(row.body),
})

// Null for a row the code doesn't know (an unknown key, or no subject), so a
// stray row can't break the list.
const toSystemTemplateRecord = (
  row: TemplateRow
): SystemTemplateRecord | null => {
  const key = communication.SystemTemplateKeySchema.safeParse(row.systemKey)
  if (!key.success || row.subject === null) {
    logger.warn(
      { systemKey: row.systemKey },
      'Skipping unknown system template'
    )
    return null
  }
  return {
    key: key.data,
    name: row.name,
    channels: parseChannels(row.channels),
    subject: row.subject,
    body: row.body,
    revision: row.revision,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  }
}

// MSSQL duplicate-key errors: 2601 = unique index, 2627 = unique constraint.
// The rep routes never write systemKey, so the only unique index they can
// hit is uq_template_active_name.
const UNIQUE_VIOLATION_NUMBERS: ReadonlySet<number> = new Set([2601, 2627])

export const isUniqueNameViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'number' in err &&
  typeof err.number === 'number' &&
  UNIQUE_VIOLATION_NUMBERS.has(err.number)

export async function listTemplates(
  status: TemplateStatusFilter
): Promise<Template[]> {
  try {
    const query = db<TemplateRow>(TABLE)
      .whereNull('systemKey')
      .orderBy('name', 'asc')
    if (status === 'active') query.where('isActive', true)
    if (status === 'archived') query.where('isActive', false)
    const rows = await query
    return rows.map(toTemplate)
  } catch (err: unknown) {
    logger.error({ err }, 'template-adapter.listTemplates')
    throw err
  }
}

export async function getTemplateById(id: string): Promise<Template | null> {
  try {
    const row = await db<TemplateRow>(TABLE)
      .where('id', id)
      .whereNull('systemKey')
      .first()
    return row ? toTemplate(row) : null
  } catch (err: unknown) {
    logger.error({ err, id }, 'template-adapter.getTemplateById')
    throw err
  }
}

// SMS only for now: channels is fixed, subject/categories stay null. Throws
// the raw unique violation on a taken active name; the route maps it to 409.
export async function createTemplate(
  params: CreateTemplateParams
): Promise<Template> {
  try {
    const [created] = await db(TABLE)
      .insert({
        name: params.name,
        channels: 'sms',
        subject: null,
        body: params.body,
        categories: null,
        isActive: true,
        updatedBy: params.updatedBy ?? null,
      })
      .returning<TemplateRow[]>('*')
    return toTemplate(created)
  } catch (err: unknown) {
    if (!isUniqueNameViolation(err)) {
      logger.error({ err }, 'template-adapter.createTemplate')
    }
    throw err
  }
}

// The revision check is part of the UPDATE, so two saves can't both land;
// this follow-up read (same scope as the update) only picks the error code.
const missReason = async (
  scope: (query: Knex.QueryBuilder) => Knex.QueryBuilder
): Promise<'not-found' | 'conflict'> =>
  (await scope(db(TABLE)).first('id')) ? 'conflict' : 'not-found'

const repTemplate = (id: string) => (query: Knex.QueryBuilder) =>
  query.where('id', id).whereNull('systemKey')

// Only name/body keys present in `params` are written, and only if the row
// is still at `params.revision`.
export async function updateTemplate(
  id: string,
  params: UpdateTemplateParams
): Promise<UpdateResult<Template>> {
  const { revision, updatedBy, ...fields } = params
  try {
    const [updated] = await repTemplate(id)(db(TABLE))
      .where('revision', revision)
      .update({
        ...fields,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
        revision: db.raw('revision + 1'),
      })
      .returning<TemplateRow[]>('*')
    if (updated) return { ok: true, template: toTemplate(updated) }
    return { ok: false, reason: await missReason(repTemplate(id)) }
  } catch (err: unknown) {
    if (!isUniqueNameViolation(err)) {
      logger.error({ err, id }, 'template-adapter.updateTemplate')
    }
    throw err
  }
}

// Archive (false) / restore (true). Restoring re-enters the filtered unique
// index, so it can throw the same unique violation as a rename.
export async function setTemplateActive(
  id: string,
  active: boolean
): Promise<Template | null> {
  try {
    const [updated] = await db(TABLE)
      .where('id', id)
      .whereNull('systemKey')
      .update({ isActive: active, updatedAt: new Date() })
      .returning<TemplateRow[]>('*')
    return updated ? toTemplate(updated) : null
  } catch (err: unknown) {
    if (!isUniqueNameViolation(err)) {
      logger.error({ err, id, active }, 'template-adapter.setTemplateActive')
    }
    throw err
  }
}

// System templates are looked up by key; a missing one is a deploy/seed
// fault, so it throws rather than returning null.
export async function getSystemTemplate(
  systemKey: SystemTemplateKey
): Promise<SystemTemplate> {
  let row: Pick<TemplateRow, 'subject' | 'body'> | undefined
  try {
    row = await db<TemplateRow>(TABLE)
      .select('subject', 'body')
      .where('systemKey', systemKey)
      .first()
  } catch (err: unknown) {
    logger.error({ err, systemKey }, 'template-adapter.getSystemTemplate')
    throw new SystemTemplateLookupError(systemKey, { cause: err })
  }
  if (!row || row.subject === null) {
    throw new SystemTemplateNotFoundError(systemKey)
  }
  return { systemKey, subject: row.subject, body: row.body }
}

export async function listSystemTemplates(): Promise<SystemTemplateRecord[]> {
  try {
    const rows = await db<TemplateRow>(TABLE)
      .whereNotNull('systemKey')
      .orderBy('name', 'asc')
    return rows
      .map(toSystemTemplateRecord)
      .filter((t): t is SystemTemplateRecord => t !== null)
  } catch (err: unknown) {
    logger.error({ err }, 'template-adapter.listSystemTemplates')
    throw err
  }
}

export async function getSystemTemplateRecord(
  key: SystemTemplateKey
): Promise<SystemTemplateRecord | null> {
  try {
    const row = await db<TemplateRow>(TABLE).where('systemKey', key).first()
    return row ? toSystemTemplateRecord(row) : null
  } catch (err: unknown) {
    logger.error({ err, key }, 'template-adapter.getSystemTemplateRecord')
    throw err
  }
}

// Subject and body, only if the row is still at `params.revision`.
export async function updateSystemTemplate(
  key: SystemTemplateKey,
  params: UpdateSystemTemplateParams
): Promise<UpdateResult<SystemTemplateRecord>> {
  try {
    const [updated] = await db(TABLE)
      .where('systemKey', key)
      .where('revision', params.revision)
      .update({
        subject: params.subject,
        body: params.body,
        updatedBy: params.updatedBy ?? null,
        updatedAt: new Date(),
        revision: db.raw('revision + 1'),
      })
      .returning<TemplateRow[]>('*')
    if (!updated) {
      return {
        ok: false,
        reason: await missReason((query) => query.where('systemKey', key)),
      }
    }
    const record = toSystemTemplateRecord(updated)
    // The write is applied; a row we can't read back is a fault, not a miss.
    if (!record) throw new Error(`Updated system template ${key} is unreadable`)
    return { ok: true, template: record }
  } catch (err: unknown) {
    logger.error({ err, key }, 'template-adapter.updateSystemTemplate')
    throw err
  }
}
