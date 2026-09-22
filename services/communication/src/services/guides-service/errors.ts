/** Thrown when a slug is already used by another guide or its history. */
export class SlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Slug "${slug}" is already taken`)
    this.name = 'SlugTakenError'
  }
}

/** Thrown when a write references a category id that does not exist. */
export class CategoryNotFoundError extends Error {
  constructor(public readonly categoryId: string) {
    super(`Category "${categoryId}" not found`)
    this.name = 'CategoryNotFoundError'
  }
}
