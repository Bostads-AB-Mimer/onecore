import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

export const schemaRegistry: Record<string, any> = {}

// Changes need to be reviewed before pushing to main, this silences TS error resulting from including "definitions" in api-types, however its not a very clean fix

export function registerSchema<T extends z.ZodType>(
  name: string,
  schema: T,
  definitions?: Record<string, z.ZodType>
) {
  const options: any = {
    name,
    target: 'openApi3',
  }

  // Only add definitions if provided (zod-to-json-schema crashes on undefined)
  if (definitions) {
    options.definitions = definitions
  }

  const result = zodToJsonSchema(schema, options)

  // Extract all definitions from the result, not just the named one
  // This ensures shared schemas (passed via definitions param) are also registered
  if (result.definitions) {
    for (const [defName, defSchema] of Object.entries(result.definitions)) {
      // Fix zod-to-json-schema quirk: it auto-creates #/definitions/* refs for reused schemas
      // but OpenAPI 3.0 needs #/components/schemas/*
      const fixedSchema = JSON.parse(
        JSON.stringify(defSchema).replace(
          /#\/definitions\//g,
          '#/components/schemas/'
        )
      )
      schemaRegistry[defName] = fixedSchema
    }
  }
}
