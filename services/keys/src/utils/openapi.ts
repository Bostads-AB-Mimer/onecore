import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

export const schemaRegistry: Record<string, any> = {}

export function registerSchema<T extends z.ZodType>(name: string, schema: T) {
  schemaRegistry[name] = zodToJsonSchema(schema, {
    name,
    target: 'openApi3',
  }).definitions?.[name]
}
