import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaRegistry: Record<string, any> = {}

export function registerSchema<T extends z.ZodType>(name: string, schema: T) {
  schemaRegistry[name] = zodToJsonSchema(schema, {
    name,
    target: 'openApi3',
  }).definitions?.[name]
}
