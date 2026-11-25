import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { db } from '../../../common/db'

type Template = communication.Template
type CreateTemplate = communication.CreateTemplate
type UpdateTemplate = communication.UpdateTemplate
type TemplateStatusFilter = communication.TemplateStatusFilter

const TABLE = 'template'

// Raw row: channels/categories are comma-separated NVARCHAR columns.
export type TemplateRow = Omit<Template, 'channels' | 'categories'> & {
  channels: string
  categories: string | null
}

const splitList = (value: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : []

export const toTemplate = (row: TemplateRow): Template => ({
  ...row,
  // The column holds channel names only; the enum parse guards against drift.
  channels: communication.TemplateSchema.shape.channels.parse(
    splitList(row.channels)
  ),
  categories: splitList(row.categories),
})

// MSSQL duplicate-key errors: 2601 = unique index, 2627 = unique constraint.
// The only unique index on `template` besides the PK is uq_template_active_name.
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
    const query = db<TemplateRow>(TABLE).orderBy('name', 'asc')
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
    const row = await db<TemplateRow>(TABLE).where('id', id).first()
    return row ? toTemplate(row) : null
  } catch (err: unknown) {
    logger.error({ err, id }, 'template-adapter.getTemplateById')
    throw err
  }
}

// SMS only for now: channels is fixed, subject/categories stay null. Throws
// the raw unique violation on a taken active name; the route maps it to 409.
export async function createTemplate(
  params: CreateTemplate
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

// Only keys present in `params` are written. Null when the id is unknown.
export async function updateTemplate(
  id: string,
  params: UpdateTemplate
): Promise<Template | null> {
  try {
    const [updated] = await db(TABLE)
      .where('id', id)
      .update({ ...params, updatedAt: new Date() })
      .returning<TemplateRow[]>('*')
    return updated ? toTemplate(updated) : null
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
