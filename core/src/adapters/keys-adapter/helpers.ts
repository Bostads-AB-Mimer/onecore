import createClient from 'openapi-fetch'
import { z } from 'zod'
import Config from '../../common/config'
import { paths } from './generated/api-types'
import {
  CommonErr,
  AdapterResult,
  PaginatedResponse,
  PaginationMetaSchema,
  PaginationLinksSchema,
} from './types'

export const client = () =>
  createClient<paths>({
    baseUrl: Config.keysService.url,
    headers: { 'Content-Type': 'application/json' },
  })

export function mapFetchError(response: { status: number }): CommonErr {
  const status = response.status
  if (status === 400) return 'bad-request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  return 'unknown'
}

export function ok<T>(data: T): AdapterResult<T, never> {
  return { ok: true, data }
}

export function fail<E extends CommonErr>(err: E): AdapterResult<never, E> {
  return { ok: false, err }
}

/**
 * Make a Zod schema lenient by accepting null for z.string().optional() fields.
 * The keys service DB returns SQL NULL for optional string fields, but the schema
 * defines them as z.string().optional() (accepts string | undefined, not null).
 * This wrapper accepts null and transforms it to undefined for those fields.
 */
export function lenient<S extends z.ZodObject<z.ZodRawShape>>(schema: S) {
  const shape = schema.shape
  const overrides: Record<string, z.ZodTypeAny> = {}

  for (const [key, fieldSchema] of Object.entries(shape)) {
    // Unwrap .optional() to check the inner type
    const inner =
      fieldSchema instanceof z.ZodOptional ? fieldSchema._def.innerType : null
    // Only target z.string().optional() fields (not already nullable)
    if (inner instanceof z.ZodString) {
      overrides[key] = z
        .string()
        .nullable()
        .optional()
        .transform((v) => v ?? undefined)
    }
  }

  return Object.keys(overrides).length > 0
    ? (schema.extend(overrides) as unknown as S)
    : schema
}

export function parsePaginated<S extends z.ZodTypeAny>(
  itemSchema: S,
  data: unknown
): PaginatedResponse<z.output<S>> {
  const obj = data as Record<string, unknown>
  return {
    content: z.array(itemSchema).parse(obj.content),
    _meta: PaginationMetaSchema.parse(obj._meta),
    _links: z.array(PaginationLinksSchema).parse(obj._links),
  }
}
