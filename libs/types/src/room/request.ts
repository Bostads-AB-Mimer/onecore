import { z } from 'zod'

import { ALL_VALID_TYPE_CODES, isValidCaptionForType } from './catalog'

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
