const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'onecore-keys',
      version: '1.0.0',
    },
  },
  apis: [
    `${basePath}/services/key-service/routes/*.{ts,js}`,
  ],
}