import z from 'zod'

export const GetLeasesStatusSchema = z.enum([
  'current',
  'upcoming',
  'about-to-end',
  'ended',
])

export const IncludeContactsQueryParamSchema = z.object({
  includeContacts: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export const FilterLeasesQueryParamsSchema = z.object({
  status: z
    .string()
    .nonempty()
    .refine(
      (value) =>
        value
          .split(',')
          .every((v) => GetLeasesStatusSchema.safeParse(v.trim()).success),
      {
        message: `Status must be one or more of ${GetLeasesStatusSchema.options.join(', ')}`,
      }
    )
    .transform((value) =>
      value
        .split(',')
        .map((v) => v.trim() as z.infer<typeof GetLeasesStatusSchema>)
    )
    .optional(),
  includeContacts: IncludeContactsQueryParamSchema,
})

export const GetLeasesOptionsSchema = FilterLeasesQueryParamsSchema.merge(
  IncludeContactsQueryParamSchema
)

export const GetLeaseOptionsSchema = IncludeContactsQueryParamSchema
