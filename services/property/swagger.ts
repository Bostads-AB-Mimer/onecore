const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'onecore-core',
      version: '1.0.0',
    },
  },
  apis: [`${basePath}/services/properties/*.{ts,js}`],
}
