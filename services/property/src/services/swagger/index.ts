import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import { swaggerSpec } from '../../swagger'
import { ResidenceSchema } from '../../types/residence'
import { BuildingTypeSchema, BuildingListSchema } from '../../types/building'
import { ComponentTypeSchema, ComponentListSchema } from '../../types/component'
import { PropertyTypeSchema, PropertyListSchema } from '../../types/property'
import zodToJsonSchema from 'zod-to-json-schema'

const schemas = {
  Residence: zodToJsonSchema(ResidenceSchema, {
    name: 'Residence',
    target: 'openApi3',
  }),
  Building: zodToJsonSchema(BuildingTypeSchema, {
    name: 'Building',
    target: 'openApi3',
  }),
  BuildingList: zodToJsonSchema(BuildingListSchema, {
    name: 'BuildingList',
    target: 'openApi3',
  }),
  Component: zodToJsonSchema(ComponentTypeSchema, {
    name: 'Component',
    target: 'openApi3',
  }),
  ComponentList: zodToJsonSchema(ComponentListSchema, {
    name: 'ComponentList',
    target: 'openApi3',
  }),
  Property: zodToJsonSchema(PropertyTypeSchema, {
    name: 'Property',
    target: 'openApi3',
  }),
  PropertyList: zodToJsonSchema(PropertyListSchema, {
    name: 'PropertyList',
    target: 'openApi3',
  }),
}

swaggerSpec.definition.components = {
  ...swaggerSpec.definition.components,
  schemas,
}

const swaggerOptions = swaggerJsdoc(swaggerSpec)

export const routes = (router: KoaRouter) => {
  router.get('/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerOptions
  })
}
