import { randomUUID } from 'crypto'
import { Knex } from 'knex'

import {
  findOrCreateCategory,
  listCategories,
} from '../adapters/categories-adapter'
import {
  createGuide,
  deleteGuide,
  getGuideById,
  getGuideBySlug,
  isSlugTaken,
  listGuides,
  updateGuide,
} from '../adapters/guides-adapter'
import { createStepImage, deleteStepImage } from '../adapters/images-adapter'
import { GuideCategoryRow } from '../adapters/rows'
import {
  CategoryNotFoundError,
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

const imageInput = (overrides: Partial<{ storageKey: string }> = {}) => ({
  id: randomUUID(),
  storageKey: overrides.storageKey ?? `guide/test/${randomUUID()}.png`,
  filename: 'screenshot.png',
  contentType: 'image/png',
  altText: 'A screenshot',
  caption: null,
})

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
      const first = await findOrCreateCategory({ name }, db)
      const second = await findOrCreateCategory({ name: `  ${name} ` }, db)

      expect(second.id).toBe(first.id)
      const listed = await listCategories(db)
      expect(listed.filter((c) => c.name === name)).toHaveLength(1)
    }))

  it('rejects an unknown category id', () =>
    withContext(async ({ db }) => {
      await expect(
        findOrCreateCategory({ id: randomUUID() }, db)
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

    const result = await findOrCreateCategory({ name: existing.name }, db)

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

    await expect(
      findOrCreateCategory({ name: existing.name }, db)
    ).rejects.toBe(failure)
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
      expect(bySlug?.redirectedFrom).toBeUndefined()
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
      const result = await updateGuide(
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
      expect(removedStorageKeys).toEqual([orphanImage!.storageKey])
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
      ))!
      const drop = (await createStepImage(
        created.id,
        step.id,
        imageInput(),
        db
      ))!
      expect([keep.sortOrder, drop.sortOrder]).toEqual([0, 1])

      const result = await updateGuide(
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

      await expect(updateGuide(created.id, moved, db)).rejects.toBeInstanceOf(
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
        updateGuide(
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
        updateGuide(
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

  it('records slug history so the old slug still resolves', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const oldSlug = created.slug
      const newSlug = `${oldSlug}-v2`

      const result = await updateGuide(
        created.id,
        factory.guideWrite.build({
          slug: newSlug,
          category: { id: created.category.id },
          steps: created.steps.map((s) => ({ ...s, images: [] })),
        }),
        db
      )
      expect(result!.guide.slug).toBe(newSlug)

      const viaOld = await getGuideBySlug(oldSlug, db)
      expect(viaOld?.id).toBe(created.id)
      expect(viaOld?.redirectedFrom).toBe(oldSlug)

      // The old slug is now reserved for this guide only.
      expect(await isSlugTaken(oldSlug, null, db)).toBe(true)
      expect(await isSlugTaken(oldSlug, created.id, db)).toBe(false)
      await expect(
        createGuide(factory.guideWrite.build({ slug: oldSlug }), db)
      ).rejects.toBeInstanceOf(SlugTakenError)

      // Taking the old slug back drops the history row.
      const back = await updateGuide(
        created.id,
        factory.guideWrite.build({
          slug: oldSlug,
          category: { id: created.category.id },
          steps: created.steps.map((s) => ({ ...s, images: [] })),
        }),
        db
      )
      expect(back!.guide.slug).toBe(oldSlug)
      const viaNew = await getGuideBySlug(newSlug, db)
      expect(viaNew?.redirectedFrom).toBe(newSlug)
    }))

  it('refuses a slug another guide holds in its history', () =>
    withContext(async ({ db }) => {
      const first = await createGuide(factory.guideWrite.build(), db)
      const oldSlug = first.slug
      await updateGuide(
        first.id,
        factory.guideWrite.build({
          slug: `${oldSlug}-v2`,
          category: { id: first.category.id },
          steps: first.steps.map((s) => ({ ...s, images: [] })),
        }),
        db
      )

      const second = await createGuide(factory.guideWrite.build(), db)
      await expect(
        updateGuide(
          second.id,
          factory.guideWrite.build({
            slug: oldSlug,
            category: { id: second.category.id },
            steps: second.steps.map((s) => ({ ...s, images: [] })),
          }),
          db
        )
      ).rejects.toBeInstanceOf(SlugTakenError)
    }))

  it('sets publishedAt on first publish and clears it when unpublished', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const base = {
        slug: created.slug,
        category: { id: created.category.id },
        steps: created.steps.map((s) => ({ ...s, images: [] })),
      }

      const published = await updateGuide(
        created.id,
        factory.guideWrite.build({ ...base, status: 'published' }),
        db
      )
      expect(published!.guide.publishedAt).toBeInstanceOf(Date)

      const unpublished = await updateGuide(
        created.id,
        factory.guideWrite.build({ ...base, status: 'draft' }),
        db
      )
      expect(unpublished!.guide.publishedAt).toBeNull()
    }))

  it('returns null when updating or deleting an unknown guide', () =>
    withContext(async ({ db }) => {
      expect(
        await updateGuide(randomUUID(), factory.guideWrite.build(), db)
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
      ))!
      const imageB = (await createStepImage(
        created.id,
        b.id,
        imageInput(),
        db
      ))!

      const result = await deleteGuide(created.id, db)

      expect(result!.storageKeys.sort()).toEqual(
        [imageA.storageKey, imageB.storageKey].sort()
      )
      expect(await getGuideById(created.id, db)).toBeNull()
    }))

  it('deletes the slug history along with the guide', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const oldSlug = created.slug
      await updateGuide(
        created.id,
        factory.guideWrite.build({
          slug: `${oldSlug}-v2`,
          category: { id: created.category.id },
          steps: created.steps.map((s) => ({ ...s, images: [] })),
        }),
        db
      )
      expect(
        await db('guide_slug_history').where('guideId', created.id)
      ).toHaveLength(1)

      await deleteGuide(created.id, db)

      expect(
        await db('guide_slug_history').where('guideId', created.id)
      ).toHaveLength(0)
      // The freed slug can be used by a new guide.
      expect(await isSlugTaken(oldSlug, null, db)).toBe(false)
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

  it('deletes an image and returns its storage key', () =>
    withContext(async ({ db }) => {
      const created = await createGuide(factory.guideWrite.build(), db)
      const image = (await createStepImage(
        created.id,
        created.steps[0].id,
        imageInput(),
        db
      ))!

      expect(await deleteStepImage(created.id, image.id, db)).toEqual({
        storageKey: image.storageKey,
      })
      expect(await deleteStepImage(created.id, image.id, db)).toBeNull()
    }))
})
