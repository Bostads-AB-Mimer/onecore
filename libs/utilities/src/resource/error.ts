import type { Resource } from './resource'

export class ResourceError extends Error {
  constructor(
    message: string,
    public resource: Resource<any>,
    cause?: Error
  ) {
    super(message, cause)
  }
}

export class ResourceNotReady extends ResourceError {}
