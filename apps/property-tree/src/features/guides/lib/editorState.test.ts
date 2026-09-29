import { describe, expect, it } from 'vitest'

import type {
  GuideCategory,
  GuideStepImageWithUrl,
  GuideWithUrls,
} from '@/entities/guide'

import {
  editorReducer,
  emptyState,
  fromGuide,
  hasAltText,
  isDirty,
  pendingImagesByStep,
  pendingImageUrls,
  toPreview,
  toRequest,
  toUpdateRequest,
  validate,
  withUploadedImages,
} from './editorState'

// The guide's updatedAt as loaded, and later values reported by the server.
const loadedAt = '2026-09-23T10:00:00.000Z'
const afterUpload = '2026-09-23T10:00:05.000Z'
const afterSecondUpload = '2026-09-23T10:00:07.000Z'

const image: GuideStepImageWithUrl = {
  id: 'img-1',
  stepId: 's1',
  sortOrder: 0,
  storageKey: 'guide/g/1.png',
  filename: '1.png',
  contentType: 'image/png',
  altText: '',
  caption: null,
  createdAt: '',
  url: 'https://minio/1.png',
}

const guide: GuideWithUrls = {
  id: 'g1',
  slug: 'min-guide',
  title: 'Min guide',
  description: 'Beskrivning',
  status: 'draft',
  category: { id: 'c1', name: 'Tenfast', createdAt: '', updatedAt: '' },
  stepCount: 1,
  createdBy: 'Anna',
  updatedBy: 'Anna',
  publishedAt: null,
  createdAt: '',
  updatedAt: loadedAt,
  steps: [
    {
      id: 's1',
      guideId: 'g1',
      sortOrder: 0,
      title: 'Steg ett',
      body: '<p>x</p>',
      calloutType: 'tip',
      calloutText: 'Tänk på',
      images: [image],
      createdAt: '',
      updatedAt: '',
    },
  ],
}

describe('editorReducer', () => {
  it('derives the slug from the title until the slug is edited', () => {
    let state = editorReducer(emptyState(), {
      type: 'set-title',
      title: 'Registrera uppsägning',
    })
    expect(state.slug).toBe('registrera-uppsagning')

    state = editorReducer(state, { type: 'set-slug', slug: 'egen-slug' })
    state = editorReducer(state, { type: 'set-title', title: 'Ny titel' })
    expect(state.slug).toBe('egen-slug')
    expect(state.dirty).toBe(true)
  })

  it('adds, reorders and removes steps', () => {
    let state = editorReducer(emptyState(), { type: 'add-step', id: 'a' })
    state = editorReducer(state, { type: 'add-step', id: 'b' })
    state = editorReducer(state, { type: 'move-step', from: 1, to: 0 })
    expect(state.steps.map((s) => s.id)).toEqual(['b', 'a'])
    expect(state.steps[0].saved).toBe(false)

    state = editorReducer(state, { type: 'remove-step', stepId: 'b' })
    expect(state.steps.map((s) => s.id)).toEqual(['a'])
  })

  it('loads a guide and marks everything as saved and clean', () => {
    const state = fromGuide(guide)
    expect(state.guideId).toBe('g1')
    expect(state.steps[0].saved).toBe(true)
    expect(state.steps[0].images[0].caption).toBe('')
    expect(state.dirty).toBe(false)
    expect(state.category).toEqual({ id: 'c1' })
  })

  it('manages images on a step', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, {
      type: 'add-image',
      stepId: 's1',
      image: { ...image, id: 'img-2' },
      guideUpdatedAt: afterUpload,
    })
    state = editorReducer(state, {
      type: 'move-image',
      stepId: 's1',
      from: 1,
      to: 0,
    })
    state = editorReducer(state, {
      type: 'update-image',
      stepId: 's1',
      imageId: 'img-2',
      patch: { altText: 'Dialogen' },
    })
    expect(state.steps[0].images.map((i) => i.id)).toEqual(['img-2', 'img-1'])
    expect(state.steps[0].images[0].altText).toBe('Dialogen')

    state = editorReducer(state, {
      type: 'remove-image',
      stepId: 's1',
      imageId: 'img-1',
      guideUpdatedAt: afterSecondUpload,
    })
    expect(state.steps[0].images).toHaveLength(1)
    expect(state.updatedAt).toBe(afterSecondUpload)
  })

  it('tracks the guide updatedAt from load, image changes and saves', () => {
    let state = fromGuide(guide)
    expect(state.updatedAt).toBe(loadedAt)
    expect(emptyState().updatedAt).toBeNull()

    state = editorReducer(state, {
      type: 'add-image',
      stepId: 's1',
      image: { ...image, id: 'img-2' },
      guideUpdatedAt: afterUpload,
    })
    expect(state.updatedAt).toBe(afterUpload)

    state = editorReducer(state, {
      type: 'saved',
      guide: { ...guide, updatedAt: afterSecondUpload },
    })
    expect(state.updatedAt).toBe(afterSecondUpload)
  })

  it('never moves updatedAt backwards when uploads finish out of order', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, {
      type: 'add-image',
      stepId: 's1',
      image: { ...image, id: 'img-late' },
      guideUpdatedAt: afterSecondUpload,
    })
    state = editorReducer(state, {
      type: 'add-image',
      stepId: 's1',
      image: { ...image, id: 'img-early' },
      guideUpdatedAt: afterUpload,
    })
    expect(state.updatedAt).toBe(afterSecondUpload)
    expect(state.steps[0].images.map((i) => i.id)).toEqual([
      'img-1',
      'img-late',
      'img-early',
    ])
  })

  it('records updatedAt from an upload that finished after its step was removed', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, { type: 'remove-step', stepId: 's1' })

    const next = editorReducer(state, {
      type: 'add-image',
      stepId: 's1',
      image: { ...image, id: 'img-2' },
      guideUpdatedAt: afterUpload,
    })

    // The server-side upload happened, so its version must be kept even
    // though the image is not added to the (removed) step.
    expect(next.updatedAt).toBe(afterUpload)
    expect(next.steps).toEqual([])
  })

  it('clears dirty and marks every step saved after a save', () => {
    let state = editorReducer(emptyState(), {
      type: 'set-title',
      title: 'Min guide',
    })
    state = editorReducer(state, { type: 'add-step', id: 'new-step' })
    expect(state.dirty).toBe(true)
    expect(state.steps[0].saved).toBe(false)

    state = editorReducer(state, { type: 'saved', guide })
    expect(state.dirty).toBe(false)
    expect(state.steps.every((step) => step.saved)).toBe(true)
  })

  it('ignores a move-step outside the list', () => {
    const state = fromGuide(guide)
    expect(editorReducer(state, { type: 'move-step', from: 0, to: 3 })).toBe(
      state
    )
    expect(editorReducer(state, { type: 'move-step', from: -1, to: 0 })).toBe(
      state
    )
  })

  it('ignores image actions on an unknown step or image', () => {
    const state = fromGuide(guide)
    const unchanged = [
      editorReducer(state, {
        type: 'add-image',
        stepId: 'nope',
        image: { ...image, id: 'img-2' },
        guideUpdatedAt: loadedAt,
      }),
      editorReducer(state, {
        type: 'update-image',
        stepId: 's1',
        imageId: 'nope',
        patch: { altText: 'x' },
      }),
      editorReducer(state, {
        type: 'remove-image',
        stepId: 's1',
        imageId: 'nope',
        guideUpdatedAt: loadedAt,
      }),
      editorReducer(state, {
        type: 'move-image',
        stepId: 's1',
        from: 0,
        to: 5,
      }),
    ]
    unchanged.forEach((next) => {
      expect(next).toBe(state)
      expect(next.dirty).toBe(false)
    })
  })
})

describe('hasAltText', () => {
  it('requires at least one non-whitespace character', () => {
    expect(hasAltText('Inloggningsrutan')).toBe(true)
    expect(hasAltText('')).toBe(false)
    expect(hasAltText('   ')).toBe(false)
  })
})

describe('validate', () => {
  it('requires title, slug, category and step titles for any save', () => {
    const problems = validate(
      editorReducer(emptyState(), { type: 'add-step', id: 'a' }),
      'draft'
    )
    expect(problems).toEqual([
      'Titel krävs.',
      'Slug får bara innehålla små bokstäver a–z, siffror och bindestreck.',
      'Välj eller skapa en kategori.',
      'Steg 1 saknar rubrik.',
    ])
  })

  it('rejects a slug that collides with the /guider/ny route', () => {
    const state = editorReducer(fromGuide(guide), {
      type: 'set-slug',
      slug: 'ny',
    })
    expect(validate(state, 'draft')).toEqual(['Adressen är reserverad'])
  })

  it('requires steps and alt texts only when publishing', () => {
    const state = fromGuide(guide)
    expect(validate(state, 'draft')).toEqual([])
    expect(validate(state, 'published')).toEqual([
      'Bild 1 i steg 1 saknar alt-text.',
    ])
    expect(validate({ ...state, steps: [] }, 'published')).toEqual([
      'En publicerad guide behöver minst ett steg.',
    ])
  })

  it('requires a name for a new category', () => {
    const state = { ...fromGuide(guide), category: { name: '  ' } }
    expect(validate(state, 'draft')).toEqual([
      'Ange ett namn på den nya kategorin.',
    ])
  })
})

describe('toRequest', () => {
  it('builds the request with image order and trimmed text', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, {
      type: 'update-image',
      stepId: 's1',
      imageId: 'img-1',
      patch: { altText: '  Dialogen  ', caption: '   ' },
    })
    const request = toRequest(state, 'published')

    expect(request.status).toBe('published')
    expect(request.category).toEqual({ id: 'c1' })
    expect(request.steps[0].images).toEqual([
      { id: 'img-1', sortOrder: 0, altText: 'Dialogen', caption: null },
    ])
    expect(request.steps[0].calloutText).toBe('Tänk på')
  })

  it('drops callout text when no callout type is set', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, {
      type: 'update-step',
      stepId: 's1',
      patch: { calloutType: null },
    })
    expect(toRequest(state, 'draft').steps[0].calloutText).toBeNull()
  })

  it('does not mark the guide dirty when a patch changes nothing', () => {
    const state = fromGuide(guide)
    const step = state.steps[0]
    const next = editorReducer(state, {
      type: 'update-step',
      stepId: step.id,
      patch: { body: step.body, title: step.title },
    })
    expect(next).toBe(state)
    expect(next.dirty).toBe(false)
  })

  it('drops blank callout text even when a callout type is set', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, {
      type: 'update-step',
      stepId: 's1',
      patch: { calloutText: '   ' },
    })
    const step = toRequest(state, 'draft').steps[0]
    expect(step.calloutType).toBe('tip')
    expect(step.calloutText).toBeNull()
  })
})

describe('toUpdateRequest', () => {
  it('sends the tracked updatedAt as expectedUpdatedAt', () => {
    let state = fromGuide(guide)
    state = editorReducer(state, {
      type: 'add-image',
      stepId: 's1',
      image: { ...image, id: 'img-2' },
      guideUpdatedAt: afterUpload,
    })

    const request = toUpdateRequest(state, 'draft')

    expect(request.expectedUpdatedAt).toBe(afterUpload)
    expect(request.steps[0].images?.map((i) => i.id)).toEqual([
      'img-1',
      'img-2',
    ])
  })

  it('refuses a guide that has never been saved', () => {
    expect(() => toUpdateRequest(emptyState(), 'draft')).toThrow()
  })
})

describe('toPreview', () => {
  const categories: GuideCategory[] = [
    { id: 'c1', name: 'Tenfast', createdAt: '', updatedAt: '' },
  ]

  it('resolves the name of an existing category', () => {
    const preview = toPreview(fromGuide(guide), 'Anna', categories)
    expect(preview.category).toMatchObject({ id: 'c1', name: 'Tenfast' })
  })

  it('uses the typed name for a new category and leaves it empty when unknown', () => {
    const state = fromGuide(guide)
    expect(
      toPreview({ ...state, category: { name: 'Nytt' } }, 'Anna', categories)
        .category.name
    ).toBe('Nytt')
    expect(toPreview(state, 'Anna', []).category.name).toBe('')
  })

  it('falls back to placeholder titles for empty fields', () => {
    let state = editorReducer(emptyState(), { type: 'add-step', id: 'a' })
    state = editorReducer(state, { type: 'add-step', id: 'b' })
    const preview = toPreview(state, 'Anna')
    expect(preview.title).toBe('Namnlös guide')
    expect(preview.slug).toBe('preview')
    expect(preview.steps.map((step) => step.title)).toEqual([
      'Steg 1',
      'Steg 2',
    ])
  })
})

describe('pending images', () => {
  const file = (name: string) => new File(['x'], name, { type: 'image/png' })

  // The loaded guide plus a new, unsaved step with two queued images.
  const withPending = () => {
    let state = editorReducer(fromGuide(guide), { type: 'add-step', id: 's2' })
    state = editorReducer(state, {
      type: 'update-step',
      stepId: 's2',
      patch: { title: 'Steg två' },
    })
    return editorReducer(
      { ...state, dirty: false },
      {
        type: 'add-pending-images',
        stepId: 's2',
        images: [
          { id: 'p1', file: file('a.png'), url: 'blob:a' },
          { id: 'p2', file: file('b.png'), url: 'blob:b' },
        ],
      }
    )
  }

  const uploaded = (id: string, stepId: string): GuideStepImageWithUrl => ({
    ...image,
    id,
    stepId,
    altText: 'Alt',
  })

  // What the server returns after saving withPending(): s2 exists, no images.
  const savedGuide: GuideWithUrls = {
    ...guide,
    updatedAt: afterUpload,
    steps: [
      ...guide.steps,
      { ...guide.steps[0], id: 's2', title: 'Steg två', images: [] },
    ],
  }

  it('queues dropped files as pending images and marks the state dirty', () => {
    const state = withPending()
    expect(state.dirty).toBe(true)
    expect(isDirty(state)).toBe(true)
    expect(state.steps[1].images).toMatchObject([
      {
        kind: 'pending',
        id: 'p1',
        url: 'blob:a',
        filename: 'a.png',
        altText: '',
        caption: '',
        error: null,
      },
      { kind: 'pending', id: 'p2', filename: 'b.png' },
    ])
  })

  it('ignores an empty drop', () => {
    const state = fromGuide(guide)
    expect(
      editorReducer(state, {
        type: 'add-pending-images',
        stepId: 's1',
        images: [],
      })
    ).toBe(state)
  })

  it('edits and reorders pending images and marks the state dirty', () => {
    let state = editorReducer(
      { ...withPending(), dirty: false },
      {
        type: 'update-image',
        stepId: 's2',
        imageId: 'p2',
        patch: { altText: 'Knappen', caption: 'Klicka här' },
      }
    )
    expect(state.dirty).toBe(true)

    state = editorReducer(
      { ...state, dirty: false },
      { type: 'move-image', stepId: 's2', from: 1, to: 0 }
    )
    expect(state.dirty).toBe(true)
    expect(state.steps[1].images.map((i) => i.id)).toEqual(['p2', 'p1'])
    expect(state.steps[1].images[0]).toMatchObject({
      altText: 'Knappen',
      caption: 'Klicka här',
    })
  })

  it('removes a pending image locally and marks the state dirty', () => {
    const state = editorReducer(
      { ...withPending(), dirty: false },
      { type: 'remove-pending-image', stepId: 's2', imageId: 'p1' }
    )
    expect(state.dirty).toBe(true)
    expect(state.steps[1].images.map((i) => i.id)).toEqual(['p2'])
  })

  it('never removes an uploaded image through remove-pending-image', () => {
    const state = fromGuide(guide)
    expect(
      editorReducer(state, {
        type: 'remove-pending-image',
        stepId: 's1',
        imageId: 'img-1',
      })
    ).toBe(state)
  })

  it('drops pending images with their step', () => {
    const state = editorReducer(withPending(), {
      type: 'remove-step',
      stepId: 's2',
    })
    expect(pendingImagesByStep(state)).toEqual([])
    expect(pendingImageUrls(state)).toEqual([])
  })

  it('lists pending images per step and their preview URLs', () => {
    const state = withPending()
    expect(
      pendingImagesByStep(state).map(({ stepId, images }) => ({
        stepId,
        ids: images.map((i) => i.id),
      }))
    ).toEqual([{ stepId: 's2', ids: ['p1', 'p2'] }])
    expect(pendingImageUrls(state)).toEqual(['blob:a', 'blob:b'])
  })

  it('leaves pending images out of the save request', () => {
    const request = toRequest(withPending(), 'draft')
    expect(request.steps.map((step) => step.images)).toEqual([
      [{ id: 'img-1', sortOrder: 0, altText: '', caption: null }],
      [],
    ])
  })

  it('requires alt text on pending images when publishing', () => {
    let state = editorReducer(withPending(), {
      type: 'update-image',
      stepId: 's1',
      imageId: 'img-1',
      patch: { altText: 'Dialogen' },
    })
    state = editorReducer(state, {
      type: 'update-image',
      stepId: 's2',
      imageId: 'p1',
      patch: { altText: 'Knappen' },
    })
    expect(validate(state, 'draft')).toEqual([])
    expect(validate(state, 'published')).toEqual([
      'Bild 2 i steg 2 saknar alt-text.',
    ])
  })

  it('keeps pending images through a save, still counting as unsaved', () => {
    const state = editorReducer(withPending(), {
      type: 'saved',
      guide: {
        ...savedGuide,
        steps: [
          savedGuide.steps[0],
          { ...savedGuide.steps[1], images: [uploaded('img-9', 's2')] },
        ],
      },
    })
    expect(state.dirty).toBe(false)
    expect(isDirty(state)).toBe(true)
    expect(state.updatedAt).toBe(afterUpload)
    expect(state.steps.every((step) => step.saved)).toBe(true)
    // Pending images go after the step's images from the server.
    expect(state.steps[1].images.map((i) => [i.kind, i.id])).toEqual([
      ['uploaded', 'img-9'],
      ['pending', 'p1'],
      ['pending', 'p2'],
    ])
  })

  it('drops pending images of a step the saved guide no longer has', () => {
    const state = editorReducer(withPending(), { type: 'saved', guide })
    expect(pendingImagesByStep(state)).toEqual([])
    expect(isDirty(state)).toBe(false)
  })

  it('replaces a pending image in place with the uploaded one', () => {
    let state = editorReducer(withPending(), {
      type: 'saved',
      guide: savedGuide,
    })
    state = editorReducer(state, {
      type: 'pending-image-uploaded',
      stepId: 's2',
      pendingId: 'p1',
      image: uploaded('img-a', 's2'),
      guideUpdatedAt: afterSecondUpload,
    })
    expect(state.steps[1].images.map((i) => [i.kind, i.id])).toEqual([
      ['uploaded', 'img-a'],
      ['pending', 'p2'],
    ])
    expect(state.updatedAt).toBe(afterSecondUpload)
    // Unsaved while p2 is pending, but the upload itself is not an edit.
    expect(state.dirty).toBe(false)
    expect(isDirty(state)).toBe(true)

    state = editorReducer(state, {
      type: 'pending-image-uploaded',
      stepId: 's2',
      pendingId: 'p2',
      image: uploaded('img-b', 's2'),
      guideUpdatedAt: afterSecondUpload,
    })
    expect(isDirty(state)).toBe(false)
    expect(toUpdateRequest(state, 'draft').steps[1].images).toEqual([
      { id: 'img-a', sortOrder: 0, altText: 'Alt', caption: null },
      { id: 'img-b', sortOrder: 1, altText: 'Alt', caption: null },
    ])
  })

  it('records updatedAt from an upload whose pending image is gone', () => {
    const state = editorReducer(fromGuide(guide), {
      type: 'pending-image-uploaded',
      stepId: 's1',
      pendingId: 'nope',
      image: uploaded('img-a', 's1'),
      guideUpdatedAt: afterUpload,
    })
    expect(state.updatedAt).toBe(afterUpload)
    expect(state.steps[0].images.map((i) => i.id)).toEqual(['img-1'])
  })

  it('marks a failed upload on the pending image and keeps it unsaved', () => {
    let state = editorReducer(withPending(), {
      type: 'saved',
      guide: savedGuide,
    })
    state = editorReducer(state, {
      type: 'pending-image-failed',
      stepId: 's2',
      pendingId: 'p1',
      error: 'a.png: kunde inte laddas upp.',
    })
    expect(state.steps[1].images[0]).toMatchObject({
      kind: 'pending',
      id: 'p1',
      error: 'a.png: kunde inte laddas upp.',
    })
    expect(isDirty(state)).toBe(true)
  })
})

describe('withUploadedImages', () => {
  it('appends uploads to their steps and keeps the latest updatedAt', () => {
    const result = withUploadedImages(guide, [
      {
        stepId: 's1',
        image: { ...image, id: 'img-late' },
        guideUpdatedAt: afterSecondUpload,
      },
      {
        stepId: 's1',
        image: { ...image, id: 'img-early' },
        guideUpdatedAt: afterUpload,
      },
      {
        stepId: 'unknown',
        image: { ...image, id: 'img-x' },
        guideUpdatedAt: afterUpload,
      },
    ])
    expect(result.updatedAt).toBe(afterSecondUpload)
    expect(result.steps[0].images.map((i) => i.id)).toEqual([
      'img-1',
      'img-late',
      'img-early',
    ])
  })

  it('returns the guide unchanged without uploads', () => {
    expect(withUploadedImages(guide, [])).toBe(guide)
  })
})
