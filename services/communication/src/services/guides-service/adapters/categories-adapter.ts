import { randomUUID } from 'crypto'
import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { CategoryNotFoundError } from '../errors'
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
 */
export async function findOrCreateCategory(
  input: guides.CategoryInput,
  db: Knex
): Promise<guides.GuideCategory> {
  try {
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
    await db('guide_category').insert({ id, name })
    const created = await db<GuideCategoryRow>('guide_category')
      .where('id', id)
      .first()
    if (!created) throw new Error('Category insert did not persist')
    return mapCategory(created)
  } catch (err) {
    if (!(err instanceof CategoryNotFoundError)) {
      logger.error({ err }, 'guidesAdapter.findOrCreateCategory')
    }
    throw err
  }
}
