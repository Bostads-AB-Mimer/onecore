import { z } from 'zod'

export const CoreWorkOrderMessageSchema = z.object({
  id: z.number(),
  body: z.string(),
  messageType: z.string(),
  author: z.string(),
  createDate: z.coerce.date(),
})

export const CoreWorkOrderSchema = z.object({
  AccessCaption: z.string(),
  Caption: z.string(),
  Code: z.string(),
  ContactCode: z.string(),
  Description: z.string(),
  DetailsCaption: z.string(),
  ExternalResource: z.boolean(),
  Id: z.string(),
  LastChanged: z.coerce.date(),
  Priority: z.string(),
  Registered: z.coerce.date(),
  RentalObjectCode: z.string(),
  Status: z.string(),
  UseMasterKey: z.boolean(),
  WorkOrderRows: z.array(
    z.object({
      Description: z.string().nullable(),
      LocationCode: z.string().nullable(),
      EquipmentCode: z.string().nullable(),
    })
  ),
  Messages: z.array(CoreWorkOrderMessageSchema).optional(),
  Url: z.string().optional(),
})

export const CreateWorkOrderResponseSchema = z.object({
  newWorkOrderId: z.number(),
})

export const CoreWorkOrderSchemaArray = z.array(CoreWorkOrderSchema)

export type CoreWorkOrderMessage = z.infer<typeof CoreWorkOrderMessageSchema>
export type CoreWorkOrder = z.infer<typeof CoreWorkOrderSchema>
export type CreateWorkOrderResponse = z.infer<
  typeof CreateWorkOrderResponseSchema
>
