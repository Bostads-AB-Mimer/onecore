import type { guides } from '@onecore/types'

import type {
  CreateGuideRequest,
  GuideCategory,
  GuideStepImageWithUrl,
  GuideWithUrls,
  UpdateGuideRequest,
} from '@/entities/guide'

import { moveItem } from '@/shared/lib/reorder'
import { isReservedSlug, isValidSlug, slugify } from '@/shared/lib/slugify'

/** Re-exported from the shared schema so the editor and the API cannot drift. */
export type CalloutType = guides.CalloutType
export type GuideStatus = 'draft' | 'published'

interface EditorImageFields {
  id: string
  url: string
  filename: string
  altText: string
  caption: string
}

/** An image stored on the server. */
export interface UploadedEditorImage extends EditorImageFields {
  kind: 'uploaded'
}

/**
 * An image dropped on a step that does not exist on the server yet (an
 * unsaved step, or any step of a new guide). It is uploaded after the next
 * save. `id` is a local id and `url` an object URL preview of `file`.
 */
export interface PendingEditorImage extends EditorImageFields {
  kind: 'pending'
  file: File
  /** Why the last upload attempt failed, or null if none has failed. */
  error: string | null
}

export type EditorImage = UploadedEditorImage | PendingEditorImage

/** A file to queue on a step, with its local id and object URL preview. */
export interface NewPendingImage {
  id: string
  file: File
  url: string
}

/** The pending images of one step, in the step's image order. */
export interface PendingStepImages {
  stepId: string
  images: PendingEditorImage[]
}

/** An image uploaded to a step after a save, as reported by the server. */
export interface UploadedStepImage {
  stepId: string
  image: GuideStepImageWithUrl
  guideUpdatedAt: string
}

export interface EditorStep {
  id: string
  title: string
  body: string
  calloutType: CalloutType | null
  calloutText: string
  images: EditorImage[]
  /**
   * False for steps added since the last save. Images dropped on them are
   * queued as pending and uploaded after the next save.
   */
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
  /**
   * The guide's updatedAt as last reported by the server (load, save, image
   * upload or delete). Sent back as expectedUpdatedAt so the server can
   * reject a save made from state that another tab has since changed.
   */
  updatedAt: string | null
  title: string
  description: string
  slug: string
  /** Once the user edits the slug by hand it stops following the title. */
  slugTouched: boolean
  category: EditorCategory | null
  status: GuideStatus
  steps: EditorStep[]
  /**
   * True after an edit since the last save. Pending images are unsaved too
   * but outlive a save until they are uploaded; isDirty() covers both.
   */
  dirty: boolean
}

export type EditorAction =
  | { type: 'load'; guide: GuideWithUrls }
  | { type: 'saved'; guide: GuideWithUrls }
  | { type: 'set-title'; title: string }
  | { type: 'set-description'; description: string }
  | { type: 'set-slug'; slug: string }
  | { type: 'set-category'; category: EditorCategory | null }
  | { type: 'add-step'; id: string }
  | { type: 'remove-step'; stepId: string }
  | { type: 'move-step'; from: number; to: number }
  | { type: 'update-step'; stepId: string; patch: StepPatch }
  | {
      type: 'add-image'
      stepId: string
      image: GuideStepImageWithUrl
      guideUpdatedAt: string
    }
  | {
      type: 'remove-image'
      stepId: string
      imageId: string
      guideUpdatedAt: string
    }
  | { type: 'move-image'; stepId: string; from: number; to: number }
  | {
      type: 'update-image'
      stepId: string
      imageId: string
      patch: Partial<Pick<EditorImage, 'altText' | 'caption'>>
    }
  | { type: 'add-pending-images'; stepId: string; images: NewPendingImage[] }
  | { type: 'remove-pending-image'; stepId: string; imageId: string }
  | {
      type: 'pending-image-uploaded'
      stepId: string
      pendingId: string
      image: GuideStepImageWithUrl
      guideUpdatedAt: string
    }
  | {
      type: 'pending-image-failed'
      stepId: string
      pendingId: string
      error: string
    }

const fromImage = (image: GuideStepImageWithUrl): UploadedEditorImage => ({
  kind: 'uploaded',
  id: image.id,
  url: image.url,
  filename: image.filename,
  altText: image.altText,
  caption: image.caption ?? '',
})

export const fromGuide = (guide: GuideWithUrls): EditorState => ({
  guideId: guide.id,
  savedSlug: guide.slug,
  updatedAt: guide.updatedAt,
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
  updatedAt: null,
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

/**
 * Apply `update` to one step. Unknown steps leave the state untouched so a
 * stale action (e.g. an upload finishing after the step was removed) never
 * marks the guide dirty.
 */
const updateStep = (
  state: EditorState,
  stepId: string,
  update: (step: EditorStep) => EditorStep
): EditorState => {
  const step = state.steps.find((candidate) => candidate.id === stepId)
  if (!step) return state
  const updated = update(step)
  if (updated === step) return state
  return {
    ...state,
    dirty: true,
    steps: state.steps.map((candidate) =>
      candidate.id === stepId ? updated : candidate
    ),
  }
}

/** Same guard as updateStep, for actions that target one image in a step. */
const updateImage = (
  state: EditorState,
  stepId: string,
  imageId: string,
  update: (images: EditorImage[]) => EditorImage[]
): EditorState =>
  updateStep(state, stepId, (step) =>
    step.images.some((image) => image.id === imageId)
      ? { ...step, images: update(step.images) }
      : step
  )

/**
 * Replace one pending image in place without touching `dirty`: uploading it
 * after a save is not an edit of its own. Unknown steps or images (e.g.
 * removed meanwhile) leave the state untouched.
 */
const replacePendingImage = (
  state: EditorState,
  stepId: string,
  pendingId: string,
  replace: (image: PendingEditorImage) => EditorImage
): EditorState => {
  const step = state.steps.find((candidate) => candidate.id === stepId)
  const pending = step?.images.find(
    (image): image is PendingEditorImage =>
      image.kind === 'pending' && image.id === pendingId
  )
  if (!step || !pending) return state
  const replaced = replace(pending)
  return {
    ...state,
    steps: state.steps.map((candidate) =>
      candidate === step
        ? {
            ...step,
            images: step.images.map((image) =>
              image === pending ? replaced : image
            ),
          }
        : candidate
    ),
  }
}

/**
 * State rebuilt from a saved guide that keeps the pending images of
 * `previous`, appended last on their step, since they are only uploaded after
 * the save.
 */
const savedWithPendingImages = (
  previous: EditorState,
  guide: GuideWithUrls
): EditorState => {
  const next = fromGuide(guide)
  const pendingByStep = new Map(
    pendingImagesByStep(previous).map(({ stepId, images }) => [stepId, images])
  )
  if (pendingByStep.size === 0) return next
  return {
    ...next,
    steps: next.steps.map((step) => {
      const pending = pendingByStep.get(step.id)
      return pending ? { ...step, images: [...step.images, ...pending] } : step
    }),
  }
}

/**
 * Record the guide's updatedAt reported by an image upload or delete. The
 * later value wins, so responses arriving out of order (e.g. two parallel
 * uploads) never move it backwards. It is recorded even when the image action
 * itself is ignored: the server-side change happened regardless.
 */
const recordUpdatedAt = (state: EditorState, updatedAt: string): EditorState =>
  state.updatedAt !== null &&
  Date.parse(state.updatedAt) >= Date.parse(updatedAt)
    ? state
    : { ...state, updatedAt }

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case 'load':
      return fromGuide(action.guide)
    case 'saved':
      return savedWithPendingImages(state, action.guide)
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
    case 'move-step': {
      const steps = moveItem(state.steps, action.from, action.to)
      if (steps === state.steps) return state
      return { ...state, dirty: true, steps }
    }
    case 'update-step':
      return updateStep(state, action.stepId, (step) => {
        // Editors can report their current value without a real edit (e.g.
        // tiptap on focus or editable toggles); that must not mark the guide
        // dirty.
        const changed = (Object.keys(action.patch) as (keyof StepPatch)[]).some(
          (key) => action.patch[key] !== step[key]
        )
        return changed ? { ...step, ...action.patch } : step
      })
    case 'add-image':
      return updateStep(
        recordUpdatedAt(state, action.guideUpdatedAt),
        action.stepId,
        (step) => ({
          ...step,
          images: [...step.images, fromImage(action.image)],
        })
      )
    case 'remove-image':
      return updateImage(
        recordUpdatedAt(state, action.guideUpdatedAt),
        action.stepId,
        action.imageId,
        (images) => images.filter((image) => image.id !== action.imageId)
      )
    case 'move-image':
      return updateStep(state, action.stepId, (step) => {
        const images = moveItem(step.images, action.from, action.to)
        return images === step.images ? step : { ...step, images }
      })
    case 'update-image':
      return updateImage(state, action.stepId, action.imageId, (images) =>
        images.map((image) =>
          image.id === action.imageId ? { ...image, ...action.patch } : image
        )
      )
    case 'add-pending-images':
      if (action.images.length === 0) return state
      return updateStep(state, action.stepId, (step) => ({
        ...step,
        images: [
          ...step.images,
          ...action.images.map(({ id, file, url }): PendingEditorImage => ({
            kind: 'pending',
            id,
            url,
            filename: file.name,
            altText: '',
            caption: '',
            file,
            error: null,
          })),
        ],
      }))
    case 'remove-pending-image':
      return updateStep(state, action.stepId, (step) =>
        step.images.some(
          (image) => image.kind === 'pending' && image.id === action.imageId
        )
          ? {
              ...step,
              images: step.images.filter(
                (image) => image.id !== action.imageId
              ),
            }
          : step
      )
    case 'pending-image-uploaded':
      return replacePendingImage(
        recordUpdatedAt(state, action.guideUpdatedAt),
        action.stepId,
        action.pendingId,
        () => fromImage(action.image)
      )
    case 'pending-image-failed':
      return replacePendingImage(
        state,
        action.stepId,
        action.pendingId,
        (pending) => ({ ...pending, error: action.error })
      )
  }
}

/** Pending images per step, only for steps that have any. */
export function pendingImagesByStep(state: EditorState): PendingStepImages[] {
  return state.steps.flatMap((step) => {
    const images = step.images.filter(
      (image): image is PendingEditorImage => image.kind === 'pending'
    )
    return images.length > 0 ? [{ stepId: step.id, images }] : []
  })
}

/** Object URLs of all pending image previews, to revoke when they go away. */
export const pendingImageUrls = (state: EditorState): string[] =>
  pendingImagesByStep(state).flatMap(({ images }) =>
    images.map((image) => image.url)
  )

/** True when there is anything a save would persist, pending images included. */
export const isDirty = (state: EditorState): boolean =>
  state.dirty || pendingImagesByStep(state).length > 0

/**
 * The saved guide with the images uploaded after the save appended to their
 * steps, and its updatedAt moved to the latest upload. Uploads for unknown
 * steps are ignored.
 */
export function withUploadedImages(
  guide: GuideWithUrls,
  uploads: readonly UploadedStepImage[]
): GuideWithUrls {
  if (uploads.length === 0) return guide
  const updatedAt = uploads.reduce(
    (latest, { guideUpdatedAt }) =>
      Date.parse(guideUpdatedAt) > Date.parse(latest) ? guideUpdatedAt : latest,
    guide.updatedAt
  )
  return {
    ...guide,
    updatedAt,
    steps: guide.steps.map((step) => {
      const images = uploads
        .filter((upload) => upload.stepId === step.id)
        .map((upload) => upload.image)
      return images.length > 0
        ? { ...step, images: [...step.images, ...images] }
        : step
    }),
  }
}

/**
 * True when an image has usable alt text. Required on every image of a
 * published guide, both when saving and when uploading to one.
 */
export const hasAltText = (altText: string): boolean =>
  altText.trim().length > 0

/**
 * Problems that block a save. Publishing has stricter rules, mirrored from
 * the shared zod schema, so the user sees them before the request is sent.
 */
export function validate(state: EditorState, status: GuideStatus): string[] {
  const problems: string[] = []
  if (state.title.trim().length === 0) problems.push('Titel krävs.')
  if (isReservedSlug(state.slug)) {
    problems.push('Adressen är reserverad')
  } else if (!isValidSlug(state.slug)) {
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
        if (!hasAltText(image.altText)) {
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
      // Pending images are unknown to the server until they are uploaded
      // after the save; sending them would be rejected as image-not-in-step.
      images: step.images
        .filter((image) => image.kind === 'uploaded')
        .map((image, index) => ({
          id: image.id,
          sortOrder: index,
          altText: image.altText.trim(),
          caption: image.caption.trim() || null,
        })),
    })),
  }
}

/** Request body for PUT: the save plus the version it was based on. */
export function toUpdateRequest(
  state: EditorState,
  status: GuideStatus
): UpdateGuideRequest {
  if (!state.updatedAt) throw new Error('Only a saved guide can be updated')
  return { ...toRequest(state, status), expectedUpdatedAt: state.updatedAt }
}

/**
 * A GuideWithUrls built from unsaved state, for the preview dialog. The
 * category list resolves the name of an already existing category, which the
 * state only holds by id.
 */
export function toPreview(
  state: EditorState,
  author: string,
  categories: readonly GuideCategory[] = []
): GuideWithUrls {
  const now = new Date().toISOString()
  const category = state.category
  const categoryName = !category
    ? ''
    : 'name' in category
      ? category.name
      : (categories.find((item) => item.id === category.id)?.name ?? '')
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
