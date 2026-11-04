import { randomUUID } from 'crypto'
import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import {
  CategoryNotFoundError,
  CategoryParentNotTopLevelError,
} from '../errors'
import { isUniqueViolation } from './db-errors'
import { GuideCategoryRow, mapCategory } from './rows'

export async function listCategories(
  db: Knex
): Promise<guides.GuideCategory[]> {
  try {
    const rows = await db<GuideCategoryRow>('guide_category').orderBy(
      'name',
      'asc'
    )
    return rows.map(mapCategory)
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.listCategories')
    throw err
  }
}

/**
 * Resolve the category for a guide write. An `id` must point at an existing
 * category; a `name` reuses the category with that name under the same
 * parent, or creates it. A `parentId` must point at a top-level category, so
 * categories nest one level deep.
 *
 * Not logged here: it runs inside createGuide/updateGuide, which log a
 * failure once at their own level.
 */
export async function resolveCategory(
  input: guides.CategoryInput,
  db: Knex
): Promise<guides.GuideCategory> {
  if ('id' in input) {
    const existing = await db<GuideCategoryRow>('guide_category')
      .where('id', input.id)
      .first()
    if (!existing) throw new CategoryNotFoundError(input.id)
    return mapCategory(existing)
  }

  const parentId = input.parentId ?? null
  if (parentId !== null) {
    const parent = await db<GuideCategoryRow>('guide_category')
      .where('id', parentId)
      .first()
    if (!parent) throw new CategoryNotFoundError(parentId)
    if (parent.parentId !== null)
      throw new CategoryParentNotTopLevelError(parentId)
  }

  // knex turns the null parentId into IS NULL for a top-level lookup.
  const key = { name: input.name.trim(), parentId }
  const byName = await db<GuideCategoryRow>('guide_category').where(key).first()
  if (byName) return mapCategory(byName)

  const id = randomUUID()
  try {
    await db('guide_category').insert({ id, ...key })
  } catch (err) {
    // Another save created the same category between the lookup and the
    // insert; the unique index on (parentId, name) caught it, so reuse that
    // row.
    if (!isUniqueViolation(err)) throw err
    const concurrent = await db<GuideCategoryRow>('guide_category')
      .where(key)
      .first()
    if (!concurrent) throw err
    return mapCategory(concurrent)
  }

  const created = await db<GuideCategoryRow>('guide_category')
    .where('id', id)
    .first()
  if (!created) throw new Error('Category insert did not persist')
  return mapCategory(created)
}
