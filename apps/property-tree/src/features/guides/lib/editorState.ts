import type {
  CreateGuideRequest,
  GuideStepImageWithUrl,
  GuideWithUrls,
} from '@/entities/guide'

import { moveItem } from '@/shared/lib/reorder'
import { isValidSlug, slugify } from '@/shared/lib/slugify'

export type CalloutType = 'tip' | 'note' | 'warning'
export type GuideStatus = 'draft' | 'published'

export interface EditorImage {
  id: string
  url: string
  filename: string
  altText: string
  caption: string
}

export interface EditorStep {
  id: string
  title: string
  body: string
  calloutType: CalloutType | null
  calloutText: string
  images: EditorImage[]
  /** False for steps added since the last save; they cannot take images yet. */
  saved: boolean
}

export type EditorCategory = { id: string } | { name: string }

export type StepPatch = Partial<
  Pick<EditorStep, 'title' | 'body' | 'calloutType' | 'calloutText'>
>

export interface EditorState {
  guideId: string | null
  /** Slug as stored on the server, to detect renames after a save. */
  savedSlug: string | null
  title: string
  description: string
  slug: string
  /** Once the user edits the slug by hand it stops following the title. */
  slugTouched: boolean
  category: EditorCategory | null
  status: GuideStatus
  steps: EditorStep[]
  dirty: boolean
}

export type EditorAction =
  | { type: 'load'; guide: GuideWithUrls }
  | { type: 'saved'; guide: GuideWithUrls }
  | { type: 'set-title'; title: string }
  | { type: 'set-description'; description: string }
  | { type: 'set-slug'; slug: string }
  | { type: 'set-category'; category: EditorCategory | null }
  | { type: 'set-status'; status: GuideStatus }
  | { type: 'add-step'; id: string }
  | { type: 'remove-step'; stepId: string }
  | { type: 'move-step'; from: number; to: number }
  | { type: 'update-step'; stepId: string; patch: StepPatch }
  | { type: 'add-image'; stepId: string; image: GuideStepImageWithUrl }
  | { type: 'remove-image'; stepId: string; imageId: string }
  | { type: 'move-image'; stepId: string; from: number; to: number }
  | {
      type: 'update-image'
      stepId: string
      imageId: string
      patch: Partial<Pick<EditorImage, 'altText' | 'caption'>>
    }

const fromImage = (image: GuideStepImageWithUrl): EditorImage => ({
  id: image.id,
  url: image.url,
  filename: image.filename,
  altText: image.altText,
  caption: image.caption ?? '',
})

export const fromGuide = (guide: GuideWithUrls): EditorState => ({
  guideId: guide.id,
  savedSlug: guide.slug,
  title: guide.title,
  description: guide.description,
  slug: guide.slug,
  slugTouched: true,
  category: { id: guide.category.id },
  status: guide.status,
  steps: guide.steps.map((step) => ({
    id: step.id,
    title: step.title,
    body: step.body,
    calloutType: step.calloutType,
    calloutText: step.calloutText ?? '',
    images: step.images.map(fromImage),
    saved: true,
  })),
  dirty: false,
})

export const emptyState = (): EditorState => ({
  guideId: null,
  savedSlug: null,
  title: '',
  description: '',
  slug: '',
  slugTouched: false,
  category: null,
  status: 'draft',
  steps: [],
  dirty: false,
})

export const newStep = (id: string): EditorStep => ({
  id,
  title: '',
  body: '',
  calloutType: null,
  calloutText: '',
  images: [],
  saved: false,
})

const updateStep = (
  state: EditorState,
  stepId: string,
  update: (step: EditorStep) => EditorStep
): EditorState => ({
  ...state,
  dirty: true,
  steps: state.steps.map((step) => (step.id === stepId ? update(step) : step)),
})

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case 'load':
    case 'saved':
      return fromGuide(action.guide)
    case 'set-title':
      return {
        ...state,
        dirty: true,
        title: action.title,
        slug: state.slugTouched ? state.slug : slugify(action.title),
      }
    case 'set-description':
      return { ...state, dirty: true, description: action.description }
    case 'set-slug':
      return { ...state, dirty: true, slug: action.slug, slugTouched: true }
    case 'set-category':
      return { ...state, dirty: true, category: action.category }
    case 'set-status':
      return { ...state, dirty: true, status: action.status }
    case 'add-step':
      return {
        ...state,
        dirty: true,
        steps: [...state.steps, newStep(action.id)],
      }
    case 'remove-step':
      return {
        ...state,
        dirty: true,
        steps: state.steps.filter((step) => step.id !== action.stepId),
      }
    case 'move-step':
      return {
        ...state,
        dirty: true,
        steps: moveItem(state.steps, action.from, action.to),
      }
    case 'update-step':
      return updateStep(state, action.stepId, (step) => ({
        ...step,
        ...action.patch,
      }))
    case 'add-image':
      return updateStep(state, action.stepId, (step) => ({
        ...step,
        images: [...step.images, fromImage(action.image)],
      }))
    case 'remove-image':
      return updateStep(state, action.stepId, (step) => ({
        ...step,
        images: step.images.filter((image) => image.id !== action.imageId),
      }))
    case 'move-image':
      return updateStep(state, action.stepId, (step) => ({
        ...step,
        images: moveItem(step.images, action.from, action.to),
      }))
    case 'update-image':
      return updateStep(state, action.stepId, (step) => ({
        ...step,
        images: step.images.map((image) =>
          image.id === action.imageId ? { ...image, ...action.patch } : image
        ),
      }))
  }
}

/**
 * Problems that block a save. Publishing has stricter rules, mirrored from
 * the shared zod schema, so the user sees them before the request is sent.
 */
export function validate(state: EditorState, status: GuideStatus): string[] {
  const problems: string[] = []
  if (state.title.trim().length === 0) problems.push('Titel krävs.')
  if (!isValidSlug(state.slug)) {
    problems.push(
      'Slug får bara innehålla små bokstäver a–z, siffror och bindestreck.'
    )
  }
  if (!state.category) problems.push('Välj eller skapa en kategori.')
  if (
    'name' in (state.category ?? {}) &&
    !(state.category as { name: string }).name.trim()
  ) {
    problems.push('Ange ett namn på den nya kategorin.')
  }
  state.steps.forEach((step, index) => {
    if (step.title.trim().length === 0) {
      problems.push(`Steg ${index + 1} saknar rubrik.`)
    }
  })

  if (status === 'published') {
    if (state.steps.length === 0) {
      problems.push('En publicerad guide behöver minst ett steg.')
    }
    state.steps.forEach((step, index) => {
      step.images.forEach((image, imageIndex) => {
        if (image.altText.trim().length === 0) {
          problems.push(
            `Bild ${imageIndex + 1} i steg ${index + 1} saknar alt-text.`
          )
        }
      })
    })
  }
  return problems
}

/** Request body for POST/PUT. Call validate() first. */
export function toRequest(
  state: EditorState,
  status: GuideStatus
): CreateGuideRequest {
  if (!state.category) throw new Error('Category is required')
  return {
    title: state.title.trim(),
    description: state.description.trim(),
    slug: state.slug,
    category:
      'id' in state.category
        ? { id: state.category.id }
        : { name: state.category.name.trim() },
    status,
    steps: state.steps.map((step) => ({
      id: step.id,
      title: step.title.trim(),
      body: step.body,
      calloutType: step.calloutType,
      calloutText: step.calloutType ? step.calloutText.trim() || null : null,
      images: step.images.map((image, index) => ({
        id: image.id,
        sortOrder: index,
        altText: image.altText.trim(),
        caption: image.caption.trim() || null,
      })),
    })),
  }
}

/** A GuideWithUrls built from unsaved state, for the preview dialog. */
export function toPreview(state: EditorState, author: string): GuideWithUrls {
  const now = new Date().toISOString()
  const categoryName =
    state.category && 'name' in state.category ? state.category.name : ''
  return {
    id: state.guideId ?? 'preview',
    slug: state.slug || 'preview',
    title: state.title || 'Namnlös guide',
    description: state.description,
    status: state.status,
    category: {
      id: state.category && 'id' in state.category ? state.category.id : 'new',
      name: categoryName,
      createdAt: now,
      updatedAt: now,
    },
    stepCount: state.steps.length,
    createdBy: author,
    updatedBy: author,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    steps: state.steps.map((step, index) => ({
      id: step.id,
      guideId: state.guideId ?? 'preview',
      sortOrder: index,
      title: step.title || `Steg ${index + 1}`,
      body: step.body,
      calloutType: step.calloutType,
      calloutText: step.calloutType ? step.calloutText : null,
      createdAt: now,
      updatedAt: now,
      images: step.images.map((image, imageIndex) => ({
        id: image.id,
        stepId: step.id,
        sortOrder: imageIndex,
        storageKey: '',
        filename: image.filename,
        contentType: '',
        altText: image.altText,
        caption: image.caption || null,
        createdAt: now,
        url: image.url,
      })),
    })),
  }
}
