import { randomUUID } from 'crypto'
import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import {
  GuideModifiedError,
  ImageNotInStepError,
  isGuideDomainError,
  SlugTakenError,
  StepBelongsToOtherGuideError,
} from '../errors'
import { resolveCategory } from './categories-adapter'
import { isUniqueViolationOn } from './db-errors'
import {
  asDateTime2,
  isSameUpdatedAt,
  lockGuide,
  nextUpdatedAt,
} from './guide-version'
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

/**
 * Load a guide with its category, steps and images. Not logged here: it runs
 * inside the adapters below, which log a failure once at their own level.
 */
async function readGuide(id: string, db: Knex): Promise<guides.Guide | null> {
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
}

export async function getGuideById(
  id: string,
  db: Knex
): Promise<guides.Guide | null> {
  try {
    return await readGuide(id, db)
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.getGuideById')
    throw err
  }
}

export async function getGuideBySlug(
  slug: string,
  db: Knex
): Promise<guides.Guide | null> {
  try {
    const guide = await db<GuideRow>('guide').where('slug', slug).first()
    return guide ? await readGuide(guide.id, db) : null
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.getGuideBySlug')
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

// Unique index on guide(slug) created by the guide migration.
const SLUG_UNIQUE_INDEX = 'uq_guide_slug'

/**
 * Slug uniqueness is enforced by the uq_guide_slug index alone, so a taken
 * slug is detected when the write fails. Translate that violation into the
 * domain error instead of letting it surface as a 500.
 */
async function guardSlugConflict(
  slug: string,
  write: () => Promise<unknown>
): Promise<void> {
  try {
    await write()
  } catch (err) {
    // Only the slug index means the slug is taken; any other unique
    // violation is a different bug and must keep its own error.
    if (isUniqueViolationOn(err, [SLUG_UNIQUE_INDEX]))
      throw new SlugTakenError(slug)
    throw err
  }
}

/**
 * Step ids come from the client, so a save can name a step that is already
 * owned by another guide. Inserting it would break on the primary key and
 * updating it would move another guide's step, so reject it up front.
 * `guideId` is the guide being written, or null when it does not exist yet.
 */
async function assertStepsAreNotOwnedByAnotherGuide(
  steps: guides.StepInput[],
  guideId: string | null,
  trx: Knex
): Promise<void> {
  if (steps.length === 0) return

  const foreign = await trx<GuideStepRow>('guide_step')
    .whereIn(
      'id',
      steps.map((step) => step.id)
    )
    .modify((qb) => {
      if (guideId) qb.whereNot('guideId', guideId)
    })
    .first()

  if (foreign) throw new StepBelongsToOtherGuideError(normalizeId(foreign.id))
}

/**
 * Check every referenced image before anything is mutated. Steps are handled
 * in order, so an image moved from one step to another would otherwise be
 * deleted as missing from its old step and then be unknown on its new one —
 * silently dropping the image and its file.
 */
async function assertImagesBelongToTheirSteps(
  guideId: string,
  steps: guides.StepInput[],
  trx: Knex
): Promise<void> {
  if (steps.every((step) => step.images.length === 0)) return

  const rows = await trx<GuideStepImageRow>('guide_step_image as i')
    .join('guide_step as s', 's.id', 'i.stepId')
    .where('s.guideId', guideId)
    .select('i.id', 'i.stepId')

  const stepIdByImageId = new Map(
    rows.map((row) => [normalizeId(row.id), normalizeId(row.stepId)])
  )

  for (const step of steps) {
    for (const image of step.images) {
      const imageId = normalizeId(image.id)
      if (stepIdByImageId.get(imageId) !== normalizeId(step.id)) {
        throw new ImageNotInStepError(imageId, normalizeId(step.id))
      }
    }
  }
}

export async function createGuide(
  input: guides.ServiceGuideWrite,
  db: Knex
): Promise<guides.Guide> {
  try {
    return await db.transaction(async (trx) => {
      await assertStepsAreNotOwnedByAnotherGuide(input.steps, null, trx)

      const category = await resolveCategory(input.category, trx)
      const id = randomUUID()
      const now = new Date()

      await guardSlugConflict(input.slug, () =>
        trx('guide').insert({
          id,
          slug: input.slug,
          title: input.title,
          description: input.description,
          categoryId: category.id,
          status: input.status,
          publishedAt: input.status === 'published' ? now : null,
          createdBy: input.author,
          updatedBy: input.author,
          // Written explicitly (instead of the column default) so the stored
          // concurrency token is exactly the millisecond clients read back.
          updatedAt: asDateTime2(trx, now),
        })
      )

      // Images cannot exist yet: they are uploaded against a saved step.
      for (const [index, step] of input.steps.entries()) {
        await trx('guide_step').insert({
          id: step.id,
          guideId: id,
          ...stepValues(step, index, now),
        })
      }

      const created = await readGuide(id, trx)
      if (!created) throw new Error('Guide insert did not persist')
      return created
    })
  } catch (err) {
    if (!isGuideDomainError(err)) {
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
 *
 * The save is rejected with GuideModifiedError when `expectedUpdatedAt` does
 * not match the stored updatedAt: a payload built from stale state would
 * otherwise delete images uploaded after that state was loaded.
 */
export async function updateGuide(
  id: string,
  input: guides.ServiceGuideUpdate,
  db: Knex
): Promise<UpdateGuideResult | null> {
  try {
    return await db.transaction(async (trx) => {
      // Locked so a concurrent upload cannot land between the version check
      // and the image deletes below.
      const existing = await lockGuide(id, trx)
      if (!existing) return null

      if (!isSameUpdatedAt(existing.updatedAt, input.expectedUpdatedAt)) {
        throw new GuideModifiedError(id)
      }

      const removedStorageKeys: string[] = []
      const now = new Date()

      // Everything is validated before the first mutation so a rejected save
      // cannot leave the guide half-written.
      await assertStepsAreNotOwnedByAnotherGuide(input.steps, id, trx)
      await assertImagesBelongToTheirSteps(id, input.steps, trx)

      const category = await resolveCategory(input.category, trx)

      await guardSlugConflict(input.slug, () =>
        trx('guide')
          .where('id', id)
          .update({
            slug: input.slug,
            title: input.title,
            description: input.description,
            categoryId: category.id,
            status: input.status,
            publishedAt:
              input.status === 'published'
                ? (existing.publishedAt ?? now)
                : null,
            updatedBy: input.author,
            updatedAt: asDateTime2(trx, nextUpdatedAt(existing.updatedAt, now)),
          })
      )

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
        // Every id was verified to exist on this step before any mutation.
        for (const [imageIndex, image] of orderedImages.entries()) {
          await trx('guide_step_image').where('id', image.id).update({
            sortOrder: imageIndex,
            altText: image.altText,
            caption: image.caption,
          })
        }
      }

      const guide = await readGuide(id, trx)
      if (!guide) throw new Error('Guide vanished during update')
      return { guide, removedStorageKeys }
    })
  } catch (err) {
    if (!isGuideDomainError(err)) {
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
      // Locked so an upload running concurrently either commits first (its
      // image is then read below and its key returned) or waits and finds
      // the guide gone. Without the lock the delete could read the images,
      // then cascade away a row committed in between, orphaning its file.
      const existing = await lockGuide(id, trx)
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
