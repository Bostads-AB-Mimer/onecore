import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

export const schemaRegistry: Record<string, any> = {}

export function registerSchema<T extends z.ZodType>(name: string, schema: T) {
  const result = zodToJsonSchema(schema, {
    name,
    target: 'openApi3',
    $refStrategy: 'none',
  })
  // Complex schemas with nested refs populate .definitions[name]
  // Simple flat schemas return the schema directly at the root
  schemaRegistry[name] = result.definitions?.[name] ?? result
}
