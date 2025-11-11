import { z } from 'zod'

export const WorkOrderMessageSchema = z.object({
  id: z.number(),
  body: z.string(),
  messageType: z.string(),
  author: z.string(),
  createDate: z.coerce.date(),
})

export const WorkOrderSchema = z.object({
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
  DueDate: z.union([z.null(), z.coerce.date()]),
  RentalObjectCode: z.string(),
  Status: z.string(),
  UseMasterKey: z.boolean(),
  HiddenFromMyPages: z.boolean().optional(),
  WorkOrderRows: z.array(
    z.object({
      Description: z.string().nullable(),
      LocationCode: z.string().nullable(),
      EquipmentCode: z.string().nullable(),
    })
  ),
  Messages: z.array(WorkOrderMessageSchema).optional(),
  Url: z.string().optional(),
})

export const OdooWorkOrderSchema = z.object({
  uuid: z.string(),
  id: z.number(),
  phone_number: z.string(),
  name: z.string(),
  contact_code: z.string(),
  description: z.string(),
  priority: z.string(),
  pet: z.string(),
  call_between: z.string(),
  hidden_from_my_pages: z.boolean().optional(),
  master_key: z.boolean().optional(),
  space_code: z.string(),
  equipment_code: z.string(),
  rental_property_id: z.string(),
  create_date: z.coerce.string(),
  due_date: z.coerce.string().nullable(),
  write_date: z.coerce.string(),
  stage_id: z.tuple([z.number(), z.string()]),
})

export const OdooWorkOrderMessageSchema = z.object({
  id: z.number(),
  res_id: z.number(),
  body: z.string(),
  message_type: z.string(),
  author_id: z.tuple([z.number(), z.string()]),
  create_date: z.coerce.string(),
})

export const XpandWorkOrderDetailsSchema = WorkOrderSchema.omit({
  DetailsCaption: true,
  ExternalResource: true,
  UseMasterKey: true,
  HiddenFromMyPages: true,
  Messages: true,
  Url: true,
}).extend({
  Caption: z.string().nullable(),
  ContactCode: z.string().nullable(),
  Priority: z.string().nullable(),
})

export const XpandWorkOrderSchema = XpandWorkOrderDetailsSchema.omit({
  Description: true,
  WorkOrderRows: true,
})

export const MaintenanceUnitSchema = z.object({
  id: z.string(),
  rentalPropertyId: z.string(),
  code: z.string(),
  caption: z.string(),
  type: z.string(),
  estateCode: z.string(),
  estate: z.string(),
})

export const RentalPropertySchema = z.object({
  id: z.string(),
  type: z.string(),
  property: z.object({
    address: z.string(),
    code: z.string(),
    entrance: z.string(),
    floor: z.string(),
    hasElevator: z.boolean(),
    // This is not nullable in onecore-types, but it is actually nullable
    washSpace: z.string().nullable(),
    area: z.number(),
    estateCode: z.string(),
    estate: z.string(),
    buildingCode: z.string(),
    building: z.string(),
  }),
  maintenanceUnits: z.array(MaintenanceUnitSchema).optional(),
})

export const LeaseSchema = z.object({
  leaseId: z.string(),
  leaseNumber: z.string(),
  type: z.string(),
  leaseStartDate: z.string(),
  // This is not nullable in onecore-types, but it is actually nullable
  leaseEndDate: z.string().optional().nullable(),
  contractDate: z.string().optional(),
  approvalDate: z.string().optional(),
})

export const TenantSchema = z.object({
  contactCode: z.string(),
  contactKey: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nationalRegistrationNumber: z.string().optional(),
  phoneNumbers: z
    .array(
      z.object({
        phoneNumber: z.string(),
        type: z.string(),
        // This is a boolean in onecore-types, but it is actually a number
        isMainNumber: z.number(),
      })
    )
    .optional(),
  emailAddress: z.string().optional(),
})

export const CreateWorkOrderRowSchema = z.object({
  LocationCode: z.string(),
  PartOfBuildingCode: z.string(),
  Description: z.string(),
  // This is not nullable in onecore-types, but it is actually nullable
  MaintenanceUnitCode: z.string().optional().nullable(),
  // This is not nullable in onecore-types, but it is actually nullable
  MaintenanceUnitCaption: z.string().optional().nullable(),
})

export const CreateWorkOrderDetailsSchema = z.object({
  ContactCode: z.string(),
  RentalObjectCode: z.string(),
  AccessOptions: z.object({
    Type: z.number(),
    // This is not nullable in onecore-types, but it is actually nullable
    PhoneNumber: z.string().nullable(),
    Email: z.string(),
    CallBetween: z.string(),
  }),
  HearingImpaired: z.boolean(),
  // This is a boolean in onecore-types, but it is actually a string
  Pet: z.string(),
  Rows: z.array(CreateWorkOrderRowSchema),
  Images: z.array(
    z.object({
      Filename: z.string(),
      ImageType: z.number(),
      Base64String: z.string(),
    })
  ),
})

export const CreateWorkOrderBodySchema = z.object({
  rentalProperty: RentalPropertySchema,
  tenant: TenantSchema,
  lease: LeaseSchema,
  details: CreateWorkOrderDetailsSchema,
})

export const GetWorkOrdersFromXpandQuerySchema = z.object({
  skip: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortAscending: z
    .string()
    .transform((s) => (s === 'true' ? true : false))
    .optional(),
})

export type WorkOrder = z.infer<typeof WorkOrderSchema>
export type WorkOrderMessage = z.infer<typeof WorkOrderMessageSchema>
export type OdooWorkOrder = z.infer<typeof OdooWorkOrderSchema>
export type OdooWorkOrderMessage = z.infer<typeof OdooWorkOrderMessageSchema>
export type XpandWorkOrderDetails = z.infer<typeof XpandWorkOrderDetailsSchema>
export type XpandWorkOrder = z.infer<typeof XpandWorkOrderSchema>
export type MaintenanceUnit = z.infer<typeof MaintenanceUnitSchema>
export type RentalProperty = z.infer<typeof RentalPropertySchema>
export type Lease = z.infer<typeof LeaseSchema>
export type Tenant = z.infer<typeof TenantSchema>
export type CreateWorkOrderDetails = z.infer<
  typeof CreateWorkOrderDetailsSchema
>
export type CreateWorkOrderRow = z.infer<typeof CreateWorkOrderRowSchema>
export type CreateWorkOrderBody = z.infer<typeof CreateWorkOrderBodySchema>
