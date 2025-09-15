import { generateRouteMetadata } from '@onecore/utilities'

export function makeResponseBody<T>(
  data: T,
  metadata: ReturnType<typeof generateRouteMetadata>
) {
  return { content: data, ...metadata }
}
