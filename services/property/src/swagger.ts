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
    `${basePath}/routes/components-route.{ts,js}`,
    `${basePath}/routes/residences-route.{ts,js}`,
    `${basePath}/routes/buildings-route.{ts,js}`,
    `${basePath}/routes/properties-route.{ts,js}`,
    `${basePath}/routes/parking-spaces-route.{ts,js}`,
    `${basePath}/routes/staircases-route.{ts,js}`,
    `${basePath}/routes/rooms-route.{ts,js}`,
    `${basePath}/routes/companies-route.{ts,js}`,
    `${basePath}/routes/health-route.{ts,js}`,
    `${basePath}/routes/swagger-route.{ts,js}`,
  ],
}
