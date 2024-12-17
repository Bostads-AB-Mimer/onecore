import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import { swaggerSpec } from '../swagger'
import { ResidenceSchema } from '../types/residence'
import { BuildingSchema } from '../types/building'
import { ComponentSchema } from '../types/component'
import { PropertySchema, PropertyDetailsSchema } from '../types/property'
import { StaircaseSchema } from '../types/staircase'
import { RoomSchema } from '../types/room'
import { CompanySchema, CompanyDetailsSchema } from '../types/company'
import {
  CompanyLinksSchema,
  PropertyLinksSchema,
  BuildingLinksSchema,
  StaircaseLinksSchema,
  ResidenceLinksSchema,
  RoomLinksSchema,
  ComponentLinksSchema,
} from '../types/links'
import zodToJsonSchema from 'zod-to-json-schema'

const schemas = {
  ...zodToJsonSchema(ResidenceSchema, {
    name: 'Residence',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(BuildingSchema, {
    name: 'Building',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(ComponentSchema, {
    name: 'Component',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(PropertySchema, {
    name: 'Property',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(PropertyDetailsSchema, {
    name: 'PropertyDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(StaircaseSchema, {
    name: 'Staircase',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(RoomSchema, {
    name: 'Room',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(CompanySchema, {
    name: 'Company',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(CompanyDetailsSchema, {
    name: 'CompanyDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(CompanyLinksSchema, {
    name: 'CompanyLinks',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(PropertyLinksSchema, {
    name: 'PropertyLinks',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(BuildingLinksSchema, {
    name: 'BuildingLinks',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(StaircaseLinksSchema, {
    name: 'StaircaseLinks',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(ResidenceLinksSchema, {
    name: 'ResidenceLinks',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(RoomLinksSchema, {
    name: 'RoomLinks',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(ComponentLinksSchema, {
    name: 'ComponentLinks',
    target: 'openApi3',
  }).definitions,
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
