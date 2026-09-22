import { randomUUID } from 'crypto'
import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { SlugTakenError } from '../errors'
import { findOrCreateCategory } from './categories-adapter'
import {
  GuideCategoryRow,
  GuideRow,
  GuideStepImageRow,
  GuideStepRow,
  mapGuide,
  mapSummary,
  normalizeId,
} from './rows'

type ListRow = GuideRow & {
  categoryName: string
  categoryCreatedAt: Date
  categoryUpdatedAt: Date
  stepCount: number
}

export async function listGuides(
  query: guides.ListGuidesQuery,
  db: Knex
): Promise<guides.GuideSummary[]> {
  try {
    const rows: ListRow[] = await db('guide as g')
      .join('guide_category as c', 'c.id', 'g.categoryId')
      .select(
        'g.*',
        'c.name as categoryName',
        'c.createdAt as categoryCreatedAt',
        'c.updatedAt as categoryUpdatedAt',
        db.raw(
          '(SELECT COUNT(*) FROM guide_step s WHERE s.guideId = g.id) AS stepCount'
        )
      )
      .modify((qb) => {
        if (!query.includeDrafts) qb.where('g.status', 'published')
      })
      .orderBy([
        { column: 'c.name', order: 'asc' },
        { column: 'g.title', order: 'asc' },
      ])

    return rows.map((row) =>
      mapSummary(
        row,
        {
          id: row.categoryId,
          name: row.categoryName,
          createdAt: row.categoryCreatedAt,
          updatedAt: row.categoryUpdatedAt,
        },
        Number(row.stepCount)
      )
    )
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.listGuides')
    throw err
  }
}

export async function getGuideById(
  id: string,
  db: Knex
): Promise<guides.Guide | null> {
  try {
    const guide = await db<GuideRow>('guide').where('id', id).first()
    if (!guide) return null

    const category = await db<GuideCategoryRow>('guide_category')
      .where('id', guide.categoryId)
      .first()
    if (!category) throw new Error(`Guide ${id} has no category`)

    const steps = await db<GuideStepRow>('guide_step')
      .where('guideId', id)
      .orderBy('sortOrder', 'asc')

    const images =
      steps.length === 0
        ? []
        : await db<GuideStepImageRow>('guide_step_image')
            .whereIn(
              'stepId',
              steps.map((step) => step.id)
            )
            .orderBy('sortOrder', 'asc')

    return mapGuide(guide, category, steps, images)
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.getGuideById')
    throw err
  }
}

/**
 * Look a guide up by its current slug, falling back to guide_slug_history so
 * links created before a rename keep working. A guide found through history
 * carries `redirectedFrom` so the caller can replace the URL.
 */
export async function getGuideBySlug(
  slug: string,
  db: Knex
): Promise<guides.Guide | null> {
  try {
    const direct = await db<GuideRow>('guide').where('slug', slug).first()
    if (direct) return getGuideById(direct.id, db)

    const historic = await db<{ guideId: string }>('guide_slug_history')
      .where('slug', slug)
      .first()
    if (!historic) return null

    const guide = await getGuideById(historic.guideId, db)
    return guide ? { ...guide, redirectedFrom: slug } : null
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.getGuideBySlug')
    throw err
  }
}

/** True when another guide owns the slug now or owned it in the past. */
export async function isSlugTaken(
  slug: string,
  excludeGuideId: string | null,
  db: Knex
): Promise<boolean> {
  try {
    const current = await db<GuideRow>('guide')
      .where('slug', slug)
      .modify((qb) => {
        if (excludeGuideId) qb.whereNot('id', excludeGuideId)
      })
      .first()
    if (current) return true

    const historic = await db('guide_slug_history')
      .where('slug', slug)
      .modify((qb) => {
        if (excludeGuideId) qb.whereNot('guideId', excludeGuideId)
      })
      .first()
    return historic !== undefined
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.isSlugTaken')
    throw err
  }
}

const stepValues = (step: guides.StepInput, sortOrder: number, now: Date) => ({
  sortOrder,
  title: step.title,
  body: step.body,
  calloutType: step.calloutType ?? null,
  calloutText: step.calloutText ?? null,
  updatedAt: now,
})

export async function createGuide(
  input: guides.ServiceGuideWrite,
  db: Knex
): Promise<guides.Guide> {
  try {
    return await db.transaction(async (trx) => {
      if (await isSlugTaken(input.slug, null, trx)) {
        throw new SlugTakenError(input.slug)
      }

      const category = await findOrCreateCategory(input.category, trx)
      const id = randomUUID()
      const now = new Date()

      await trx('guide').insert({
        id,
        slug: input.slug,
        title: input.title,
        description: input.description,
        categoryId: category.id,
        status: input.status,
        publishedAt: input.status === 'published' ? now : null,
        createdBy: input.author,
        updatedBy: input.author,
      })

      // Images cannot exist yet: they are uploaded against a saved step.
      for (const [index, step] of input.steps.entries()) {
        await trx('guide_step').insert({
          id: step.id,
          guideId: id,
          ...stepValues(step, index, now),
        })
      }

      const created = await getGuideById(id, trx)
      if (!created) throw new Error('Guide insert did not persist')
      return created
    })
  } catch (err) {
    if (!(err instanceof SlugTakenError)) {
      logger.error({ err }, 'guidesAdapter.createGuide')
    }
    throw err
  }
}

export type UpdateGuideResult = {
  guide: guides.Guide
  removedStorageKeys: string[]
}

/**
 * Replace a guide's metadata and steps. Steps are upserted by their
 * client-supplied id; steps missing from the payload are deleted together
 * with their images. Image rows are only ever updated or removed here (they
 * are created by the upload endpoint). Storage keys of removed images are
 * returned so the caller can delete the files.
 */
export async function updateGuide(
  id: string,
  input: guides.ServiceGuideWrite,
  db: Knex
): Promise<UpdateGuideResult | null> {
  try {
    return await db.transaction(async (trx) => {
      const existing = await trx<GuideRow>('guide').where('id', id).first()
      if (!existing) return null

      const removedStorageKeys: string[] = []
      const now = new Date()

      if (input.slug !== existing.slug) {
        if (await isSlugTaken(input.slug, id, trx)) {
          throw new SlugTakenError(input.slug)
        }
        // A guide may take back one of its own old slugs; the row for that
        // slug must go so the unique index accepts it as the current slug.
        await trx('guide_slug_history')
          .where({ guideId: id, slug: input.slug })
          .delete()
        await trx('guide_slug_history').insert({
          guideId: id,
          slug: existing.slug,
        })
      }

      const category = await findOrCreateCategory(input.category, trx)

      await trx('guide')
        .where('id', id)
        .update({
          slug: input.slug,
          title: input.title,
          description: input.description,
          categoryId: category.id,
          status: input.status,
          publishedAt:
            input.status === 'published' ? (existing.publishedAt ?? now) : null,
          updatedBy: input.author,
          updatedAt: now,
        })

      const existingSteps = await trx<GuideStepRow>('guide_step').where(
        'guideId',
        id
      )
      const existingStepIds = new Set(
        existingSteps.map((step) => normalizeId(step.id))
      )
      const inputStepIds = new Set(
        input.steps.map((step) => normalizeId(step.id))
      )

      const stepsToDelete = existingSteps.filter(
        (step) => !inputStepIds.has(normalizeId(step.id))
      )
      if (stepsToDelete.length > 0) {
        const stepIds = stepsToDelete.map((step) => step.id)
        const orphaned = await trx<GuideStepImageRow>(
          'guide_step_image'
        ).whereIn('stepId', stepIds)
        removedStorageKeys.push(...orphaned.map((image) => image.storageKey))
        // Cascade removes the image rows.
        await trx('guide_step').whereIn('id', stepIds).delete()
      }

      for (const [index, step] of input.steps.entries()) {
        const values = stepValues(step, index, now)
        if (existingStepIds.has(normalizeId(step.id))) {
          await trx('guide_step').where('id', step.id).update(values)
        } else {
          await trx('guide_step').insert({
            id: step.id,
            guideId: id,
            ...values,
          })
        }

        const existingImages = await trx<GuideStepImageRow>(
          'guide_step_image'
        ).where('stepId', step.id)
        const existingImageIds = new Set(
          existingImages.map((image) => normalizeId(image.id))
        )
        const inputImageIds = new Set(
          step.images.map((image) => normalizeId(image.id))
        )

        const imagesToDelete = existingImages.filter(
          (image) => !inputImageIds.has(normalizeId(image.id))
        )
        if (imagesToDelete.length > 0) {
          removedStorageKeys.push(
            ...imagesToDelete.map((image) => image.storageKey)
          )
          await trx('guide_step_image')
            .whereIn(
              'id',
              imagesToDelete.map((image) => image.id)
            )
            .delete()
        }

        const orderedImages = [...step.images].sort(
          (a, b) => a.sortOrder - b.sortOrder
        )
        for (const [imageIndex, image] of orderedImages.entries()) {
          if (!existingImageIds.has(normalizeId(image.id))) {
            // Images are created by the upload endpoint, never by a save.
            logger.warn(
              { guideId: id, stepId: step.id, imageId: image.id },
              'guidesAdapter.updateGuide: ignoring unknown image id'
            )
            continue
          }
          await trx('guide_step_image').where('id', image.id).update({
            sortOrder: imageIndex,
            altText: image.altText,
            caption: image.caption,
          })
        }
      }

      const guide = await getGuideById(id, trx)
      if (!guide) throw new Error('Guide vanished during update')
      return { guide, removedStorageKeys }
    })
  } catch (err) {
    if (!(err instanceof SlugTakenError)) {
      logger.error({ err }, 'guidesAdapter.updateGuide')
    }
    throw err
  }
}

/** Delete a guide and return the storage keys of all its images. */
export async function deleteGuide(
  id: string,
  db: Knex
): Promise<{ storageKeys: string[] } | null> {
  try {
    return await db.transaction(async (trx) => {
      const existing = await trx<GuideRow>('guide').where('id', id).first()
      if (!existing) return null

      const images = await trx<GuideStepImageRow>('guide_step_image as i')
        .join('guide_step as s', 's.id', 'i.stepId')
        .where('s.guideId', id)
        .select('i.storageKey')

      await trx('guide').where('id', id).delete()

      return { storageKeys: images.map((image) => image.storageKey) }
    })
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.deleteGuide')
    throw err
  }
}
