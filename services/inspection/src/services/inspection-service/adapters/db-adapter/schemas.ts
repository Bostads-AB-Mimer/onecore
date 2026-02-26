import { z } from 'zod'

export const CreateInspectionRemarkSchema = z.object({
  remarkId: z.string({ required_error: 'Remark ID is required' }),
  location: z.string().nullable(),
  buildingComponent: z.string().nullable(),
  notes: z.string().nullable(),
  remarkGrade: z.number({ required_error: 'Remark grade is required' }),
  remarkStatus: z.string().nullable(),
  cost: z.number({ required_error: 'Cost is required' }),
  invoice: z.boolean({ required_error: 'Invoice flag is required' }),
  quantity: z.number({ required_error: 'Quantity is required' }),
  isMissing: z.boolean({ required_error: 'isMissing flag is required' }),
  fixedDate: z.coerce.date().nullable(),
  workOrderCreated: z.boolean({
    required_error: 'workOrderCreated flag is required',
  }),
  workOrderStatus: z.number().nullable(),
})

export const CreateInspectionRoomSchema = z.object({
  room: z
    .string({ required_error: 'Room name is required' })
    .min(1, 'Room name cannot be empty'),
  remarks: z.array(CreateInspectionRemarkSchema),
})

export const CreateInspectionSchema = z.object({
  status: z.string({ required_error: 'Status is required' }),
  date: z.coerce.date({ required_error: 'Date is required' }),
  startedAt: z.coerce.date().nullable(),
  endedAt: z.coerce.date().nullable(),
  inspector: z.string({ required_error: 'Inspector is required' }),
  type: z.string({ required_error: 'Inspection type is required' }),
  residenceId: z.string({ required_error: 'Residence ID is required' }),
  address: z.string({ required_error: 'Address is required' }),
  apartmentCode: z.string().nullable(),
  isFurnished: z.boolean({ required_error: 'isFurnished flag is required' }),
  leaseId: z.string({ required_error: 'Lease ID is required' }),
  isTenantPresent: z.boolean({
    required_error: 'isTenantPresent flag is required',
  }),
  isNewTenantPresent: z.boolean({
    required_error: 'isNewTenantPresent flag is required',
  }),
  masterKeyAccess: z.string().nullable(),
  hasRemarks: z.boolean({ required_error: 'hasRemarks flag is required' }),
  notes: z.string().nullable(),
  totalCost: z.number().nullable(),
  rooms: z
    .array(CreateInspectionRoomSchema, {
      required_error: 'Rooms array is required',
      invalid_type_error: 'Rooms must be an array',
    })
    .min(1, 'At least one room is required for an inspection'),
})

export type CreateInspectionParams = z.infer<typeof CreateInspectionSchema>

export const INSPECTION_STATUSES = [
  'Registrerad',
  'Påbörjad',
  'Genomförd',
] as const

export const VALID_STATUS_TRANSITIONS: Record<string, string> = {
  Registrerad: 'Påbörjad',
  Påbörjad: 'Genomförd',
}

export const UpdateInspectionStatusSchema = z.object({
  status: z.enum(INSPECTION_STATUSES, {
    required_error: 'Status is required',
    invalid_type_error: 'Invalid status value',
  }),
})

export type UpdateInspectionStatusParams = z.infer<
  typeof UpdateInspectionStatusSchema
>

export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): { ok: true } | { ok: false; err: string } {
  const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus]
  if (!allowedNext || allowedNext !== newStatus) {
    return {
      ok: false,
      err: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
    }
  }
  return { ok: true }
}
