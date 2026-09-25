import { randomUUID } from 'crypto'
import { Knex } from 'knex'
import { guides } from '@onecore/types'

import { resolveCategory, listCategories } from '../adapters/categories-adapter'
import {
  createGuide,
  deleteGuide,
  getGuideById,
  getGuideBySlug,
  listGuides,
  updateGuide,
} from '../adapters/guides-adapter'
import { createStepImage, deleteStepImage } from '../adapters/images-adapter'
import { GuideCategoryRow } from '../adapters/rows'
import {
  AltTextRequiredError,
  CategoryNotFoundError,
  GuideModifiedError,
  ImageNotInStepError,
  SlugTakenError,
  StepBelongsToOtherGuideError,
} from '../errors'
import * as factory from './factories'
import { withContext } from './testUtils'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

const imageInput = (
  overrides: Partial<{ storageKey: string; altText: string | undefined }> = {}
): guides.CreateStepImageRequest => ({
  id: randomUUID(),
  storageKey: overrides.storageKey ?? `guide/test/${randomUUID()}.png`,
  filename: 'screenshot.png',
  contentType: 'image/png',
  altText: 'altText' in overrides ? overrides.altText : 'A screenshot',
  caption: null,
})

/** The guide's current concurrency token, as a client would echo it back. */
const currentVersion = async (id: string, db: Knex) =>
  ((await getGuideById(id, db))?.updatedAt ?? new Date()).toISOString()

/** updateGuide with the current token, for tests about other behaviour. */
const updateCurrent = async (
  id: string,
  input: guides.ServiceGuideWrite,
  db: Knex
) =>
  updateGuide(
    id,
    { ...input, expectedUpdatedAt: await currentVersion(id, db) },
    db
  )

const uniqueViolation = () =>
  Object.assign(new Error('Violation of UNIQUE KEY constraint'), {
    number: 2627,
  })

/**
 * A stand-in for knex that reproduces the category race: the lookup by name
 * misses, and the insert then hits the unique index because a concurrent save
 * created the row in between. The race cannot be staged against the real
 * database because the test transaction holds the lock on the new row.
 */
const racingCategoryDb = (existing: GuideCategoryRow, insertError: Error) => {
  const lookups: (GuideCategoryRow | undefined)[] = [undefined, existing]
  const table = () => ({
    where: () => ({ first: async () => lookups.shift() }),
    insert: async () => {
      throw insertError
    },
  })
  return { db: table as unknown as Knex, lookups }
}

describe('categories-adapter', () => {
  it('creates a category by name and reuses it on the next write', () =>
    withContext(async ({ db }) => {
      const name = `Tenfast ${randomUUID().slice(0, 8)}`
      const first = await resolveCategory({ name }, db)
      const second = await resolveCategory({ name: `  ${name} ` }, db)

      expect(second.id).toBe(first.id)
      const listed = await listCategories(db)
      expect(listed.filter((c) => c.name === name)).toHaveLength(1)
    }))

  it('rejects an unknown category id', () =>
    withContext(async ({ db }) => {
      await expect(
        resolveCategory({ id: randomUUID() }, db)
      ).rejects.toBeInstanceOf(CategoryNotFoundError)
    }))

  it('reuses the row when the insert races with another save', async () => {
    const existing: GuideCategoryRow = {
      id: randomUUID(),
      name: 'Tenfast',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { db, lookups } = racingCategoryDb(existing, uniqueViolation())

    const result = await resolveCategory({ name: existing.name }, db)

    expect(result.id).toBe(existing.id)
    // Both the initial miss and the retry lookup were consumed.
    expect(lookups).toHaveLength(0)
  })

  it('rethrows an insert error that is not a unique violation', async () => {
    const existing: GuideCategoryRow = {
      id: randomUUID(),
      name: 'Tenfast',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const failure = new Error('connection lost')
    const { db } = racingCategoryDb(existing, failure)

    await expect(resolveCategory({ name: existing.name }, db)).rejects.toBe(
      failure
    )
  })
})

describe('guides-adapter', () => {
  it('creates a guide with ordered steps and reads it back by id and slug', () =>
    withContext(async ({ db }) => {
      const input = factory.guideWrite.build({
        steps: factory.step.buildList(3),
      })

      const created = await createGuide(input, db)

      expect(created.slug).toBe(input.slug)
      expect(created.status).toBe('draft')
      expect(created.publishedAt).toBeNull()
      expect(created.createdBy).toBe('Test User')
      expect(created.stepCount).toBe(3)
      expect(created.steps.map((s) => s.id)).toEqual(
        input.steps.map((s) => s.id)
      )
      expect(created.steps.map((s) => s.sortOrder)).toEqual([0, 1, 2])

      const byId = await getGuideById(created.id, db)
      expect(byId?.title).toBe(input.title)

      const bySlug = await getGuideBySlug(input.slug, db)
      expect(bySlug?.id).toBe(created.id)
    }))

  it('sets publishedAt when created as published', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(
        factory.guideWrite.build({ status: 'published' }),
        db
      )
      expect(created.publishedAt).toBeInstanceOf(Date)
    }))

  it('refuses a slug that another guide already uses', () =>
    withContext(async ({ db }) => {
      const first = await createGuide(factory.guideWrite.build(), db)
      await expect(
        createGuide(factory.guideWrite.build({ slug: first.slug }), db)
      ).rejects.toBeInstanceOf(SlugTakenError)
    }))

  it('hides drafts from the list unless includeDrafts is set', () =>
    withContext(async ({ db }) => {
      const draft = await createGuide(factory.guideWrite.build(), db)
      const published = await createGuide(
        factory.guideWrite.build({ status: 'published' }),
        db
      )

      const visible = await listGuides({ includeDrafts: false }, db)
      expect(visible.map((g) => g.id)).toContain(published.id)
      expect(visible.map((g) => g.id)).not.toContain(draft.id)

      const all = await listGuides({ includeDrafts: true }, db)
      expect(all.map((g) => g.id)).toEqual(
        expect.arrayContaining([draft.id, published.id])
      )
      expect(all.find((g) => g.id === draft.id)?.stepCount).toBe(2)
    }))

  it('upserts steps by id, reorders them and deletes missing ones', () =>
    withContext(async ({ db }) => {
      const [a, b, c] = factory.step.buildList(3)
      const created = await createGuide(
        factory.guideWrite.build({ steps: [a, b, c] }),
        db
      )

      const orphanImage = await createStepImage(
        created.id,
        b.id,
        imageInput(),
        db
      )
      expect(orphanImage).not.toBeNull()

      const newStep = factory.step.build()
      const result = await updateCurrent(
        created.id,
        factory.guideWrite.build({
          slug: created.slug,
          category: { id: created.category.id },
          steps: [c, { ...a, title: 'Renamed' }, newStep],
        }),
        db
      )

      expect(result).not.toBeNull()
      const { guide, removedStorageKeys } = result!
      expect(guide.steps.map((s) => s.id)).toEqual([c.id, a.id, newStep.id])
      expect(guide.steps.map((s) => s.sortOrder)).toEqual([0, 1, 2])
      expect(guide.steps[1].title).toBe('Renamed')
      // Step b was removed, so its image file must be cleaned up by core.
      expect(removedStorageKeys).toEqual([orphanImage!.image.storageKey])
    }))

  it('keeps referenced images, updates their metadata and removes the rest', () =>
    withContext(async ({ db }) => {
      const step = factory.step.build()
      const created = await createGuide(
        factory.guideWrite.build({ steps: [step] }),
        db
      )
      const keep = (await createStepImage(
        created.id,
        step.id,
        imageInput(),
        db
      ))!.image
      const drop = (await createStepImage(
        created.id,
        step.id,
        imageInput(),
        db
      ))!.image
      expect([keep.sortOrder, drop.sortOrder]).toEqual([0, 1])

      const result = await updateCurrent(
        created.id,
        factory.guideWrite.build({
          slug: created.slug,
          category: { id: created.category.id },
          steps: [
            {
              ...step,
              images: [
                {
                  id: keep.id,
                  sortOrder: 0,
                  altText: 'Updated alt',
                  caption: 'A caption',
                },
              ],
            },
          ],
        }),
        db
      )

      const images = result!.guide.steps[0].images
      expect(images).toHaveLength(1)
      expect(images[0].id).toBe(keep.id)
      expect(images[0].altText).toBe('Updated alt')
      expect(images[0].caption).toBe('A caption')
      expect(images[0].storageKey).toBe(keep.storageKey)
      expect(result!.removedStorageKeys).toEqual([drop.storageKey])
    }))

  it('refuses an image sent on another step and keeps it untouched', () =>
    withContext(async ({ db }) => {
      const [a, b] = factory.step.buildList(2)
      const created = await createGuide(
        factory.guideWrite.build({ steps: [a, b] }),
        db
      )
      const image = (await createStepImage(created.id, a.id, imageInput(), db))!
        .image

      const moved = factory.guideWrite.build({
        slug: created.slug,
        category: { id: created.category.id },
        steps: [
          { ...a, images: [] },
          {
            ...b,
            images: [
              { id: image.id, sortOrder: 0, altText: 'Alt', caption: null },
            ],
          },
        ],
      })

      await expect(updateCurrent(created.id, moved, db)).rejects.toBeInstanceOf(
        ImageNotInStepError
      )

      // The image must survive: the storage key was never reported as
      // removed, so core would not have deleted the file either.
      const after = await getGuideById(created.id, db)
      expect(after!.steps[0].images.map((i) => i.id)).toEqual([image.id])
      expect(after!.steps[1].images).toEqual([])
    }))

  it('refuses an unknown image id instead of ignoring it', () =>
    withContext(async ({ db }) => {
      const step = factory.step.build()
      const created = await createGuide(
        factory.guideWrite.build({ steps: [step] }),
        db
      )

      await expect(
        updateCurrent(
          created.id,
          factory.guideWrite.build({
            slug: created.slug,
            category: { id: created.category.id },
            steps: [
              {
                ...step,
                images: [
                  {
                    id: randomUUID(),
                    sortOrder: 0,
                    altText: 'Alt',
                    caption: null,
                  },
                ],
              },
            ],
          }),
          db
        )
      ).rejects.toBeInstanceOf(ImageNotInStepError)
    }))

  it('refuses a step id that belongs to another guide', () =>
    withContext(async ({ db }) => {
      const other = await createGuide(factory.guideWrite.build(), db)
      const mine = await createGuide(factory.guideWrite.build(), db)
      const stolen = factory.step.build({ id: other.steps[0].id })

      await expect(
        updateCurrent(
          mine.id,
          factory.guideWrite.build({
            slug: mine.slug,
            category: { id: mine.category.id },
            steps: [stolen],
          }),
          db
        )
      ).rejects.toBeInstanceOf(StepBelongsToOtherGuideError)

      await expect(
        createGuide(factory.guideWrite.build({ steps: [stolen] }), db)
      ).rejects.toBeInstanceOf(StepBelongsToOtherGuideError)

      // The other guide still owns its step.
      const untouched = await getGuideById(other.id, db)
      expect(untouched!.steps.map((s) => s.id)).toEqual(
        other.steps.map((s) => s.id)
      )
    }))

  it('frees the old slug on rename: it no longer resolves and a new guide can take it', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const oldSlug = created.slug
      const newSlug = `${oldSlug}-v2`

      const result = await updateCurrent(
        created.id,
        factory.guideWrite.build({
          slug: newSlug,
          category: { id: created.category.id },
          steps: created.steps.map((s) => ({ ...s, images: [] })),
        }),
        db
      )
      expect(result!.guide.slug).toBe(newSlug)

      expect(await getGuideBySlug(oldSlug, db)).toBeNull()
      expect((await getGuideBySlug(newSlug, db))?.id).toBe(created.id)

      const successor = await createGuide(
        factory.guideWrite.build({ slug: oldSlug }),
        db
      )
      expect((await getGuideBySlug(oldSlug, db))?.id).toBe(successor.id)
    }))

  it('refuses to rename a guide onto a slug another guide uses', () =>
    withContext(async ({ db }) => {
      const first = await createGuide(factory.guideWrite.build(), db)
      const second = await createGuide(factory.guideWrite.build(), db)

      await expect(
        updateCurrent(
          second.id,
          factory.guideWrite.build({
            slug: first.slug,
            category: { id: second.category.id },
            steps: second.steps.map((s) => ({ ...s, images: [] })),
          }),
          db
        )
      ).rejects.toEqual(new SlugTakenError(first.slug))

      // Neither guide changed.
      expect((await getGuideById(second.id, db))?.slug).toBe(second.slug)
      expect((await getGuideBySlug(first.slug, db))?.id).toBe(first.id)
    }))

  it('sets publishedAt on first publish and clears it when unpublished', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const base = {
        slug: created.slug,
        category: { id: created.category.id },
        steps: created.steps.map((s) => ({ ...s, images: [] })),
      }

      const published = await updateCurrent(
        created.id,
        factory.guideWrite.build({ ...base, status: 'published' }),
        db
      )
      expect(published!.guide.publishedAt).toBeInstanceOf(Date)

      const unpublished = await updateCurrent(
        created.id,
        factory.guideWrite.build({ ...base, status: 'draft' }),
        db
      )
      expect(unpublished!.guide.publishedAt).toBeNull()
    }))

  it('returns null when updating or deleting an unknown guide', () =>
    withContext(async ({ db }) => {
      expect(
        await updateCurrent(randomUUID(), factory.guideWrite.build(), db)
      ).toBeNull()
      expect(await deleteGuide(randomUUID(), db)).toBeNull()
    }))

  it('deletes a guide and returns every image storage key', () =>
    withContext(async ({ db }) => {
      const [a, b] = factory.step.buildList(2)
      const created = await createGuide(
        factory.guideWrite.build({ steps: [a, b] }),
        db
      )
      const imageA = (await createStepImage(
        created.id,
        a.id,
        imageInput(),
        db
      ))!.image
      const imageB = (await createStepImage(
        created.id,
        b.id,
        imageInput(),
        db
      ))!.image

      const result = await deleteGuide(created.id, db)

      expect(result!.storageKeys.sort()).toEqual(
        [imageA.storageKey, imageB.storageKey].sort()
      )
      expect(await getGuideById(created.id, db)).toBeNull()
    }))
})

describe('guide version (optimistic concurrency)', () => {
  const sameGuide = (
    guide: guides.Guide,
    steps: guides.StepInput[] = guide.steps.map((s) => ({ ...s, images: [] }))
  ) =>
    factory.guideWrite.build({
      slug: guide.slug,
      category: { id: guide.category.id },
      steps,
    })

  it('accepts the current updatedAt and returns a newer one that round-trips', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)

      const first = await updateGuide(
        created.id,
        {
          ...sameGuide(created),
          expectedUpdatedAt: created.updatedAt.toISOString(),
        },
        db
      )
      expect(first!.guide.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime()
      )

      // The returned value is exactly what is stored, so the editor can send
      // it back as is on its next save.
      const second = await updateGuide(
        created.id,
        {
          ...sameGuide(created),
          title: 'Second save',
          expectedUpdatedAt: first!.guide.updatedAt.toISOString(),
        },
        db
      )
      expect(second!.guide.title).toBe('Second save')
    }))

  it('rejects a stale expectedUpdatedAt and leaves the guide untouched', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const loadedAt = created.updatedAt.toISOString()

      await updateGuide(
        created.id,
        { ...sameGuide(created), title: 'Tab A', expectedUpdatedAt: loadedAt },
        db
      )

      await expect(
        updateGuide(
          created.id,
          {
            ...sameGuide(created),
            title: 'Tab B',
            expectedUpdatedAt: loadedAt,
          },
          db
        )
      ).rejects.toBeInstanceOf(GuideModifiedError)

      expect((await getGuideById(created.id, db))!.title).toBe('Tab A')
    }))

  it('rejects a save from state loaded before an image upload and keeps the image', () =>
    withContext(async ({ db }) => {
      const step = factory.step.build()
      const created = await createGuide(
        factory.guideWrite.build({ steps: [step] }),
        db
      )
      const staleVersion = created.updatedAt.toISOString()

      // Another tab uploads an image: the guide's updatedAt moves forward.
      const upload = (await createStepImage(
        created.id,
        step.id,
        imageInput(),
        db
      ))!
      expect(upload.guideUpdatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime()
      )
      expect((await getGuideById(created.id, db))!.updatedAt).toEqual(
        upload.guideUpdatedAt
      )

      // The stale tab does not know the image and would delete it.
      await expect(
        updateGuide(
          created.id,
          { ...sameGuide(created), expectedUpdatedAt: staleVersion },
          db
        )
      ).rejects.toBeInstanceOf(GuideModifiedError)
      const afterStale = await getGuideById(created.id, db)
      expect(afterStale!.steps[0].images.map((i) => i.id)).toEqual([
        upload.image.id,
      ])

      // The tab that uploaded the image saves with the value the upload
      // returned.
      const saved = await updateGuide(
        created.id,
        {
          ...sameGuide(created, [
            {
              ...step,
              images: [
                {
                  id: upload.image.id,
                  sortOrder: 0,
                  altText: 'Alt',
                  caption: null,
                },
              ],
            },
          ]),
          expectedUpdatedAt: upload.guideUpdatedAt.toISOString(),
        },
        db
      )
      expect(saved!.removedStorageKeys).toEqual([])
      expect(saved!.guide.steps[0].images[0].altText).toBe('Alt')
    }))

  it('bumps updatedAt when an image is deleted', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const upload = (await createStepImage(
        created.id,
        created.steps[0].id,
        imageInput(),
        db
      ))!

      const deleted = await deleteStepImage(created.id, upload.image.id, db)

      expect(deleted!.guideUpdatedAt.getTime()).toBeGreaterThan(
        upload.guideUpdatedAt.getTime()
      )
      await expect(
        updateGuide(
          created.id,
          {
            ...sameGuide(created),
            expectedUpdatedAt: upload.guideUpdatedAt.toISOString(),
          },
          db
        )
      ).rejects.toBeInstanceOf(GuideModifiedError)
    }))

  it('returns null for an image upload on an unknown guide', () =>
    withContext(async ({ db }) => {
      expect(
        await createStepImage(randomUUID(), randomUUID(), imageInput(), db)
      ).toBeNull()
    }))
})

describe('images-adapter', () => {
  it('refuses an image on a step that belongs to another guide', () =>
    withContext(async ({ db }) => {
      const other = await createGuide(factory.guideWrite.build(), db)
      const mine = await createGuide(factory.guideWrite.build(), db)

      const result = await createStepImage(
        mine.id,
        other.steps[0].id,
        imageInput(),
        db
      )
      expect(result).toBeNull()
    }))

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])(
    'rejects an image with %s alt text on a published guide',
    (_label, altText) =>
      withContext(async ({ db }) => {
        const created = await createGuide(
          factory.guideWrite.build({ status: 'published' }),
          db
        )
        const before = created.updatedAt.getTime()

        await expect(
          createStepImage(
            created.id,
            created.steps[0].id,
            imageInput({ altText }),
            db
          )
        ).rejects.toBeInstanceOf(AltTextRequiredError)

        // Nothing was written: no image row and no version bump.
        const stored = await getGuideById(created.id, db)
        expect(stored?.steps[0].images).toEqual([])
        expect(stored?.updatedAt.getTime()).toBe(before)
      })
  )

  it('accepts an image with alt text on a published guide', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(
        factory.guideWrite.build({ status: 'published' }),
        db
      )

      const result = await createStepImage(
        created.id,
        created.steps[0].id,
        imageInput({ altText: 'The login form' }),
        db
      )

      expect(result?.image.altText).toBe('The login form')
    }))

  it('accepts an image without alt text on a draft guide', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(
        factory.guideWrite.build({ status: 'draft' }),
        db
      )

      const result = await createStepImage(
        created.id,
        created.steps[0].id,
        imageInput({ altText: undefined }),
        db
      )

      expect(result?.image.altText).toBe('')
    }))

  it('deletes an image and returns its storage key', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const image = (await createStepImage(
        created.id,
        created.steps[0].id,
        imageInput(),
        db
      ))!.image

      expect(await deleteStepImage(created.id, image.id, db)).toEqual({
        storageKey: image.storageKey,
        guideUpdatedAt: expect.any(Date),
      })
      expect(await deleteStepImage(created.id, image.id, db)).toBeNull()
    }))
})
