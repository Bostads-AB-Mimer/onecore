import { Knex } from 'knex'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { GuideStepImageRow, GuideStepRow, mapImage } from './rows'

/**
 * Record an uploaded image on a step. Called by core once the bytes are in
 * file-storage. Returns null when the step does not belong to the guide.
 */
export async function createStepImage(
  guideId: string,
  stepId: string,
  input: guides.CreateStepImageRequest,
  db: Knex
): Promise<guides.GuideStepImage | null> {
  try {
    const step = await db<GuideStepRow>('guide_step')
      .where({ id: stepId, guideId })
      .first()
    if (!step) return null

    const last = await db<GuideStepImageRow>('guide_step_image')
      .where('stepId', stepId)
      .max<{ max: number | null }[]>('sortOrder as max')
    const sortOrder = (last[0]?.max ?? -1) + 1

    await db('guide_step_image').insert({
      id: input.id,
      stepId,
      sortOrder,
      storageKey: input.storageKey,
      filename: input.filename,
      contentType: input.contentType,
      altText: input.altText ?? '',
      caption: input.caption ?? null,
    })

    const created = await db<GuideStepImageRow>('guide_step_image')
      .where('id', input.id)
      .first()
    if (!created) throw new Error('Image insert did not persist')
    return mapImage(created)
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.createStepImage')
    throw err
  }
}

/** Remove an image row. Returns its storage key so the file can be deleted. */
export async function deleteStepImage(
  guideId: string,
  imageId: string,
  db: Knex
): Promise<{ storageKey: string } | null> {
  try {
    const image = await db<GuideStepImageRow>('guide_step_image as i')
      .join('guide_step as s', 's.id', 'i.stepId')
      .where('i.id', imageId)
      .andWhere('s.guideId', guideId)
      .select('i.id', 'i.storageKey')
      .first()
    if (!image) return null

    await db('guide_step_image').where('id', image.id).delete()
    return { storageKey: image.storageKey }
  } catch (err) {
    logger.error({ err }, 'guidesAdapter.deleteStepImage')
    throw err
  }
}
