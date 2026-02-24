import { schemaRegistry } from './utils/openapi'

const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'onecore-core',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {},
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    `${basePath}/services/auth-service/*.{ts,js}`,
    `${basePath}/services/health-service/*.{ts,js}`,
    `${basePath}/services/lease-service/*.{ts,js}`,
    `${basePath}/services/property-management-service/*.{ts,js}`,
    `${basePath}/services/work-order-service/*.{ts,js}`,
    `${basePath}/services/property-base-service/*.{ts,js}`,
    `${basePath}/services/search-service/*.{ts,js}`,
    `${basePath}/services/file-storage-service/*.{ts,js}`,
    `${basePath}/services/keys-service/*.{ts,js}`,
  ],
  paths: [],
}

export function updateSwaggerSchemas() {
  swaggerSpec.definition.components.schemas = {
    ...swaggerSpec.definition.components.schemas,
    ...schemaRegistry,
  }
}
