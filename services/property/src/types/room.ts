import { z } from 'zod'
import { ALL_VALID_TYPE_CODES, isValidCaptionForType } from '@onecore/types'

export const roomsQueryParamsSchema = z.object({
  rentalId: z.string().min(1, { message: 'rentalId is required.' }),
  roomCode: z.string().optional(),
})

export const roomsByFacilityQueryParamsSchema = z.object({
  facilityId: z.string().min(1, { message: 'facilityId is required.' }),
})

export const RoomTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  use: z.number(),
  optionAllowed: z.number(),
  isSystemStandard: z.number(),
  allowSmallRoomsInValuation: z.number(),
  timestamp: z.string(),
})

export const RoomSchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  usage: z.object({
    shared: z.boolean(),
    allowPeriodicWorks: z.boolean(),
    spaceType: z.number(),
  }),
  features: z.object({
    hasToilet: z.boolean(),
    isHeated: z.boolean(),
    hasThermostatValve: z.boolean(),
    orientation: z.number(),
  }),
  dates: z.object({
    installation: z.date().nullable(),
    from: z.date(),
    to: z.date(),
    availableFrom: z.date().nullable(),
    availableTo: z.date().nullable(),
  }),
  sortingOrder: z.number(),
  deleted: z.boolean(),
  timestamp: z.string(),
  roomType: RoomTypeSchema.nullable(),
  area: z.number().optional(),
})

export type Room = z.infer<typeof RoomSchema>

export const CreateRoomRequestSchema = z
  .object({
    rentalId: z.string().min(1, { message: 'rentalId is required.' }),
    roomTypeCode: z.enum(ALL_VALID_TYPE_CODES, {
      errorMap: () => ({
        message: `roomTypeCode must be one of: ${ALL_VALID_TYPE_CODES.join(', ')}`,
      }),
    }),
    code: z.string().min(1).max(30).optional(),
    caption: z.string().min(1).max(30).optional(),
    features: z
      .object({
        hasToilet: z.boolean().optional(),
        isHeated: z.boolean().optional(),
        hasThermostatValve: z.boolean().optional(),
        orientation: z.number().int().min(0).max(255).optional(),
      })
      .optional(),
    usage: z
      .object({
        shared: z.boolean().optional(),
        allowPeriodicWorks: z.boolean().optional(),
        spaceType: z.number().int().min(0).max(255).optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.caption !== undefined &&
      !isValidCaptionForType(val.roomTypeCode, val.caption)
    ) {
      ctx.addIssue({
        path: ['caption'],
        code: z.ZodIssueCode.custom,
        message: `caption "${val.caption}" is not a valid option for roomTypeCode "${val.roomTypeCode}"`,
      })
    }
  })

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>
