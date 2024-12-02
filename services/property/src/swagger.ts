const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'property-base',
      version: '1.0.0',
    },
    components: {},
  },
  apis: [
    `${basePath}/services/components/*.{ts,js}`,
    `${basePath}/services/residences/*.{ts,js}`,
    `${basePath}/services/buildings/*.{ts,js}`,
    `${basePath}/services/properties/*.{ts,js}`,
    `${basePath}/services/staircases/*.{ts,js}`,
  ],
}
