/** Thrown when a slug is already used by another guide or its history. */
export class SlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Slug "${slug}" is already taken`)
    this.name = 'SlugTakenError'
  }
}

/**
 * Thrown when a save references an image id that does not exist on the step
 * it was sent in — either because it is unknown or because it belongs to
 * another step. Images may only be moved by deleting and re-uploading them,
 * so accepting the payload would silently delete the image file.
 */
export class ImageNotInStepError extends Error {
  constructor(
    public readonly imageId: string,
    public readonly stepId: string
  ) {
    super(`Image "${imageId}" does not belong to step "${stepId}"`)
    this.name = 'ImageNotInStepError'
  }
}

/** Thrown when a save reuses a step id that is owned by another guide. */
export class StepBelongsToOtherGuideError extends Error {
  constructor(public readonly stepId: string) {
    super(`Step "${stepId}" belongs to another guide`)
    this.name = 'StepBelongsToOtherGuideError'
  }
}

/** Thrown when a write references a category id that does not exist. */
export class CategoryNotFoundError extends Error {
  constructor(public readonly categoryId: string) {
    super(`Category "${categoryId}" not found`)
    this.name = 'CategoryNotFoundError'
  }
}

/**
 * True for the errors above: rejected requests the caller can act on, mapped
 * to a 4xx response. They are not logged as adapter errors.
 */
export const isGuideDomainError = (err: unknown): boolean =>
  err instanceof SlugTakenError ||
  err instanceof CategoryNotFoundError ||
  err instanceof ImageNotInStepError ||
  err instanceof StepBelongsToOtherGuideError
