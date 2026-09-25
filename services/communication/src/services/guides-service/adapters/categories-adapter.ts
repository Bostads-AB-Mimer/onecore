import { randomUUID } from 'crypto'
import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { CategoryNotFoundError } from '../errors'
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
 * category; a `name` reuses the category with that name or creates it.
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

  const name = input.name.trim()
  const byName = await db<GuideCategoryRow>('guide_category')
    .where('name', name)
    .first()
  if (byName) return mapCategory(byName)

  const id = randomUUID()
  try {
    await db('guide_category').insert({ id, name })
  } catch (err) {
    // Another save created the same category between the lookup and the
    // insert; the unique index on name caught it, so reuse that row.
    if (!isUniqueViolation(err)) throw err
    const concurrent = await db<GuideCategoryRow>('guide_category')
      .where('name', name)
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
