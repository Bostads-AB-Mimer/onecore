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
 * Thrown when a save was based on an older version of the guide than the one
 * stored, e.g. another tab saved or uploaded an image in between. Accepting it
 * would delete images the stale payload does not know about.
 */
export class GuideModifiedError extends Error {
  constructor(public readonly guideId: string) {
    super(`Guide "${guideId}" was modified since it was loaded`)
    this.name = 'GuideModifiedError'
  }
}

/**
 * Thrown when an image without alt text is uploaded to a published guide.
 * publishRules only runs on saves, so without this check an upload would put
 * an image without alt text in front of readers.
 */
export class AltTextRequiredError extends Error {
  constructor(public readonly guideId: string) {
    super(`Guide "${guideId}" is published; uploaded images need alt text`)
    this.name = 'AltTextRequiredError'
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
  err instanceof StepBelongsToOtherGuideError ||
  err instanceof GuideModifiedError ||
  err instanceof AltTextRequiredError
