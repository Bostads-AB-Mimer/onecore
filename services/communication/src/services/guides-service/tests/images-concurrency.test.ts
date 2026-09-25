import { randomUUID } from 'crypto'

import { db } from '../../../common/db'
import { createGuide, deleteGuide } from '../adapters/guides-adapter'
import { lockGuide } from '../adapters/guide-version'
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
/**
 * Wait until some other session is blocked by the given session, i.e. a
 * concurrent statement is queued behind a lock that session holds. Polls
 * instead of sleeping a fixed time so the test does not depend on timing.
 */
async function waitUntilBlockedBy(sessionId: number): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const [row] = await db.raw<{ blocked: number }[]>(
      'SELECT COUNT(*) AS blocked FROM sys.dm_os_waiting_tasks ' +
        'WHERE blocking_session_id = ?',
      [sessionId]
    )
    if (row.blocked > 0) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`No session got blocked by session ${sessionId}`)
}

describe('guide image concurrency', () => {
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

  it('returns the storage key of an image uploaded while the guide is being deleted', async () => {
    const guide = await createGuide(
      factory.guideWrite.build({ steps: factory.step.buildList(1) }),
      db
    )
    createdGuideIds.push(guide.id)
    createdCategoryIds.push(guide.category.id)
    const storageKey = `guide/${guide.id}/${randomUUID()}.png`

    // An upload that has taken the guide lock (as createStepImage does
    // first) but not yet inserted its row.
    const upload = await db.transaction()
    try {
      await lockGuide(guide.id, upload)
      const [{ sessionId }] = await upload.raw<{ sessionId: number }[]>(
        'SELECT @@SPID AS sessionId'
      )

      // Wait until the delete is queued behind the upload's lock. Without
      // the lock in deleteGuide it gets here after already reading the
      // (still empty) image list and blocks only on the guide delete itself,
      // so the row inserted below would be cascaded away unreported.
      const deleting = deleteGuide(guide.id, db)
      await waitUntilBlockedBy(sessionId)

      await upload('guide_step_image').insert({
        id: randomUUID(),
        stepId: guide.steps[0].id,
        sortOrder: 0,
        storageKey,
        filename: 'screenshot.png',
        contentType: 'image/png',
        altText: 'A screenshot',
        caption: null,
      })
      await upload.commit()

      const result = await deleting
      expect(result?.storageKeys).toEqual([storageKey])
    } finally {
      if (!upload.isCompleted()) await upload.rollback()
    }

    const remaining = await db('guide_step_image').where(
      'storageKey',
      storageKey
    )
    expect(remaining).toEqual([])
  })
})
