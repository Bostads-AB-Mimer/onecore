import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

export const schemaRegistry: Record<string, any> = {}

export function registerSchema<T extends z.ZodType>(name: string, schema: T) {
  const result = zodToJsonSchema(schema, {
    name,
    target: 'openApi3',
  })

  let schemaResult = result.definitions?.[name]

  // Fix zod-to-json-schema quirk: it auto-creates #/definitions/* refs for reused schemas
  // but OpenAPI 3.0 needs #/components/schemas/*
  if (schemaResult) {
    schemaResult = JSON.parse(
      JSON.stringify(schemaResult).replace(
        /#\/definitions\//g,
        '#/components/schemas/'
      )
    )
  }

  schemaRegistry[name] = schemaResult
}
