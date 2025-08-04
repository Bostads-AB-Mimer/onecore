import { z } from 'zod'
import { RouteErrorResponseSchema } from '../schemas'

type RouteErrorResponse = z.infer<typeof RouteErrorResponseSchema>

export { RouteErrorResponse }
