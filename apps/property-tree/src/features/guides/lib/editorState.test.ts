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
  toPreview,
  toRequest,
  toUpdateRequest,
  validate,
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
