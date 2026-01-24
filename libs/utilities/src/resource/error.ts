import type { Resource } from './resource'

export class ResourceError extends Error {
  constructor(
    message: string,
    cause: Error,
    public resource: Resource<any>
  ) {
    super(message, cause)
  }
}
