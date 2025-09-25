import { schemaRegistry } from './utils/openapi'

const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'onecore-keys',
      version: '1.0.0',
    },
    components: {
      schemas: {},
    },
  },
  apis: [
    `${basePath}/services/key-service/routes/*.{ts,js}`,
  ],
}

export function updateSwaggerSchemas() {
  swaggerSpec.definition.components.schemas = {
    ...swaggerSpec.definition.components.schemas,
    ...schemaRegistry,
  }
}