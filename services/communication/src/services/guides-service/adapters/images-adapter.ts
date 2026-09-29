import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { AltTextRequiredError, isGuideDomainError } from '../errors'
import { lockGuide, touchGuide } from './guide-version'
import { GuideStepImageRow, GuideStepRow, mapImage } from './rows'

/**
 * Record an uploaded image on a step. Called by core once the bytes are in
 * file-storage. Returns null when the step does not belong to the guide.
 *
 * The image changes the guide, so the guide's updatedAt is bumped: a save
 * from an editor loaded before the upload is then rejected instead of
 * deleting the new image. The new value is returned so the editor that
 * uploaded the image can keep saving.
 */
export async function createStepImage(
  guideId: string,
  stepId: string,
  input: guides.CreateStepImageRequest,
  db: Knex
): Promise<guides.CreateStepImageResponse | null> {
  try {
    return await db.transaction(async (trx) => {
      const guide = await lockGuide(guideId, trx)
      if (!guide) return null

      const step = await trx<GuideStepRow>('guide_step')
        .where({ id: stepId, guideId })
        .first()
      if (!step) return null

      // publishRules only guards saves. An upload goes live immediately on a
      // published guide, so it must carry alt text itself. Checked under the
      // guide lock so a concurrent publish cannot slip in between.
      if (guide.status === 'published' && !input.altText?.trim()) {
        throw new AltTextRequiredError(guideId)
      }

      // MAX + 1 is safe against parallel uploads (the editor uploads dropped
      // files concurrently) only because lockGuide above holds an UPDLOCK on
      // the guide row until commit: every upload to this guide waits for the
      // previous one to commit before reading MAX.
      const last = await trx<GuideStepImageRow>('guide_step_image')
        .where('stepId', stepId)
        .max<{ max: number | null }[]>('sortOrder as max')
      const sortOrder = (last[0]?.max ?? -1) + 1

      await trx('guide_step_image').insert({
        id: input.id,
        stepId,
        sortOrder,
        storageKey: input.storageKey,
        filename: input.filename,
        contentType: input.contentType,
        altText: input.altText ?? '',
        caption: input.caption ?? null,
      })

      const created = await trx<GuideStepImageRow>('guide_step_image')
        .where('id', input.id)
        .first()
      if (!created) throw new Error('Image insert did not persist')

      const guideUpdatedAt = await touchGuide(guide, trx)
      return { image: mapImage(created), guideUpdatedAt }
    })
  } catch (err) {
    if (!isGuideDomainError(err)) {
      logger.error({ err }, 'guidesAdapter.createStepImage')
    }
    throw err
  }
}

/**
 * Remove an image row. Returns its storage key so the file can be deleted,
 * and the guide's bumped updatedAt (see createStepImage).
 */
export async function deleteStepImage(
  guideId: string,
  imageId: string,
  db: Knex
): Promise<guides.DeleteStepImageResponse | null> {
  try {
    return await db.transaction(async (trx) => {
      const guide = await lockGuide(guideId, trx)
      if (!guide) return null

      const image = await trx<GuideStepImageRow>('guide_step_image as i')
        .join('guide_step as s', 's.id', 'i.stepId')
        .where('i.id', imageId)
        .andWhere('s.guideId', guideId)
        .select('i.id', 'i.storageKey')
        .first()
      if (!image) return null

      await trx('guide_step_image').where('id', image.id).delete()

      const guideUpdatedAt = await touchGuide(guide, trx)
      return { storageKey: image.storageKey, guideUpdatedAt }
    })
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.deleteStepImage')
    throw err
  }
}
