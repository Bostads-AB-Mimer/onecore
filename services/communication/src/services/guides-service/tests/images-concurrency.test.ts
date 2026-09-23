import { randomUUID } from 'crypto'

import { db } from '../../../common/db'
import { createGuide, deleteGuide } from '../adapters/guides-adapter'
import { createStepImage } from '../adapters/images-adapter'
import { GuideStepImageRow } from '../adapters/rows'
import * as factory from './factories'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

/**
 * Real concurrency needs separate connections and transactions, which the
 * rolled-back withContext harness cannot give. These tests use the shared
 * pool and delete what they create.
 */
describe('createStepImage concurrency', () => {
  const createdGuideIds: string[] = []
  const createdCategoryIds: string[] = []

  afterEach(async () => {
    for (const id of createdGuideIds.splice(0)) {
      await deleteGuide(id, db)
    }
    const categoryIds = createdCategoryIds.splice(0)
    if (categoryIds.length > 0) {
      await db('guide_category').whereIn('id', categoryIds).delete()
    }
  })

  it('gives parallel uploads to one step distinct, contiguous sortOrders', async () => {
    const guide = await createGuide(
      factory.guideWrite.build({ steps: factory.step.buildList(1) }),
      db
    )
    createdGuideIds.push(guide.id)
    createdCategoryIds.push(guide.category.id)
    const stepId = guide.steps[0].id

    const uploadCount = 6
    await Promise.all(
      Array.from({ length: uploadCount }, () =>
        createStepImage(
          guide.id,
          stepId,
          {
            id: randomUUID(),
            storageKey: `guide/test/${randomUUID()}.png`,
            filename: 'screenshot.png',
            contentType: 'image/png',
            altText: 'A screenshot',
            caption: null,
          },
          db
        )
      )
    )

    const rows = await db<GuideStepImageRow>('guide_step_image')
      .where('stepId', stepId)
      .orderBy('sortOrder')
    expect(rows.map((row) => row.sortOrder)).toEqual(
      Array.from({ length: uploadCount }, (_, index) => index)
    )
  })
})
