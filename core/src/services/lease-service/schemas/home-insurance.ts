import { leasing } from '@onecore/types'
import z from 'zod'

// The tenant's person fields. They come only from the contacts service, and
// are all null when it fails, when the contact has a protected identity or
// when it has no record of the contact.
export const HomeInsuranceContactFieldsSchema = z.object({
  fullName: z.string().nullable(),
  // Personnummer, or organisationsnummer for a company.
  nationalIdNumber: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
})

// A row of the staff home insurance list: leasing's list item, which holds
// no person data, with the person fields from the contacts service.
export const HomeInsuranceListItemWithContactSchema =
  leasing.HomeInsuranceListItemSchema.merge(HomeInsuranceContactFieldsSchema)

// The query of GET /leases/home-insurances in core. contactCodes is left
// out: core sets it itself when q is a personnummer.
export const HomeInsuranceListQuerySchema =
  leasing.HomeInsuranceListQueryParamsSchema.omit({ contactCodes: true })

// Error codes the home insurance list and its export answer with in `error`.
export const HomeInsuranceListRouteErrorCodeSchema = z.enum([
  'invalid-query',
  'cache-warming',
  'upstream-failed',
  'unknown',
])

export const HomeInsuranceListErrorResponseSchema = z.object({
  error: HomeInsuranceListRouteErrorCodeSchema,
  // The invalid parameters, with invalid-query.
  details: z.array(z.unknown()).optional(),
})

// The error body of the home insurance routes for one lease. error is
// leasing's code, passed on as it is.
export const HomeInsuranceErrorResponseSchema = z.object({
  error: z.enum([
    ...leasing.HomeInsuranceErrorCodeSchema.options,
    'invalid-request',
    'unknown',
  ]),
  reason: z.string(),
})

// The body core answers 400 with when parseRequestBody rejects the request
// body, before leasing is called. It has no error code.
export const InvalidRequestBodyResponseSchema = z.object({
  status: z.literal('error'),
  data: z.array(
    z.object({
      message: z.string(),
      path: z.array(z.union([z.string(), z.number()])),
    })
  ),
})

export type HomeInsuranceContactFields = z.infer<
  typeof HomeInsuranceContactFieldsSchema
>
export type HomeInsuranceListItemWithContact = z.infer<
  typeof HomeInsuranceListItemWithContactSchema
>
export type HomeInsuranceListQuery = z.infer<
  typeof HomeInsuranceListQuerySchema
>
export type HomeInsuranceListRouteErrorCode = z.infer<
  typeof HomeInsuranceListRouteErrorCodeSchema
>
