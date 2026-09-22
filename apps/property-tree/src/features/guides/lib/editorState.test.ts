import type { GuideStepImageWithUrl, GuideWithUrls } from '@/entities/guide'

import {
  editorReducer,
  emptyState,
  fromGuide,
  toRequest,
  validate,
} from './editorState'

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
  updatedAt: '',
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
    })
    expect(state.steps[0].images).toHaveLength(1)
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
})
