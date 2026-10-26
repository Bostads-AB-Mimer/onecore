import { OkapiRouter } from 'koa-okapi-router'
import { ApplicantStatus, leasing, ListingStatus } from '@onecore/types'
import z from 'zod'

import { AppModules } from '@src/context'
import { getAccessToken } from '@src/middlewares/require-user-token'
import { forwardCoreError } from '@src/services/common/forward-core-error'
import {
  CoreErrorResponseBodySchema,
  ErrorResponseBodySchema,
} from '@src/services/auth-service/schema'

const VacantApartmentsResponseSchema = z.object({
  content: z.array(leasing.VacantApartmentSchema),
})

// The parts of core's GET /listings/:id this layer reads. Core composes the
// apartment from property (object), Tenfast (rent, tenure, vacancy) and
// leasing (listing, applicants).
const CoreListingSchema = leasing.ListingSchema.extend({
  applicants: z
    .array(z.object({ status: z.nativeEnum(ApplicantStatus) }))
    .optional(),
  rentalObject: z.object({
    address: z.string(),
    residentialAreaCaption: z.string(),
    roomCount: z.number().nullish(),
    boaArea: z.number().nullish(),
    floor: z.string().nullish(),
    // Missing when Tenfast did not answer.
    availabilityInfo: z
      .object({
        vacantFrom: z.coerce.date().nullish(),
        rent: z.object({ amount: z.number() }),
        rentalTenureType: leasing.VacantApartmentTagSchema.nullish(),
      })
      .nullish(),
  }),
})

// Applicants still in the running count as applying. Those who withdrew, were
// withdrawn, no longer qualify, declined or let an offer expire, or lost the
// object to someone else stay on the listing for its history only.
const ACTIVE_APPLICANT_STATUSES: ReadonlySet<ApplicantStatus> = new Set([
  ApplicantStatus.Active,
  ApplicantStatus.Offered,
  ApplicantStatus.OfferAccepted,
  ApplicantStatus.Assigned,
])

// What the listing page shows: the listing and its apartment, with the number
// of active applicants instead of the applicants themselves.
const BostadListingSchema = z.object({
  id: z.number(),
  status: z.nativeEnum(ListingStatus),
  publishedTo: z.coerce.date().nullable(),
  rentalObjectCode: z.string(),
  address: z.string(),
  areaName: z.string(), // "Område"
  tenureType: leasing.VacantApartmentTagSchema.nullable(), // "Lägenhetstyp", Tenfast category
  roomCount: z.number().nullable(),
  size: z.number().nullable(), // BOA, m²
  floor: z.string().nullable(),
  rent: z.number().nullable(), // monthly, from Tenfast
  vacantFrom: z.coerce.date().nullable(),
  activeApplicantCount: z.number().int(),
})

const BostadListingResponseSchema = z.object({ content: BostadListingSchema })

const toBostadListing = (
  listing: z.infer<typeof CoreListingSchema>
): z.infer<typeof BostadListingSchema> => {
  const { rentalObject } = listing
  const availability = rentalObject.availabilityInfo
  return {
    id: listing.id,
    status: listing.status,
    publishedTo: listing.publishedTo ?? null,
    rentalObjectCode: listing.rentalObjectCode,
    address: rentalObject.address,
    areaName: rentalObject.residentialAreaCaption,
    tenureType: availability?.rentalTenureType ?? null,
    roomCount: rentalObject.roomCount ?? null,
    size: rentalObject.boaArea ?? null,
    floor: rentalObject.floor ?? null,
    rent: availability?.rent.amount ?? null,
    vacantFrom: availability?.vacantFrom ?? null,
    activeApplicantCount: (listing.applicants ?? []).filter((a) =>
      ACTIVE_APPLICANT_STATUSES.has(a.status)
    ).length,
  }
}

/** Core passthroughs for the Bostad pages: this layer adds auth, a typed spec
 * for the frontend and, for single listings, a shape cut to what the page shows. */
export const routes = (router: OkapiRouter, { coreClient }: AppModules) => {
  router.get(
    '/bostad/vacant-apartments',
    {
      summary: 'Apartments ready to be published',
      description:
        'Vacant or soon-vacant apartments without an indefinite rental block that are not ' +
        'already published or further along in the letting process. Passthrough to core.',
      tags: ['Bostad'],
      response: {
        200: VacantApartmentsResponseSchema,
        401: CoreErrorResponseBodySchema,
        502: CoreErrorResponseBodySchema, // core 5xx, body kept; or unexpected-core-response
      },
    },
    async (ctx) => {
      const result = await coreClient.request(getAccessToken(ctx), {
        method: 'get',
        path: '/vacant-apartments',
      })

      if (!result.ok) {
        return forwardCoreError(ctx, result)
      }

      const parsed = VacantApartmentsResponseSchema.safeParse(result.data)
      if (!parsed.success) {
        ctx.status = 502
        ctx.body = { error: 'unexpected-core-response' }
        return
      }

      ctx.status = 200
      ctx.body = { content: parsed.data.content }
    }
  )

  router.get(
    '/bostad/listings/:listingId',
    {
      summary: 'An apartment listing with its object information',
      description:
        'The listing, its apartment and the number of active applicants, for the listing page. ' +
        'Reads core’s GET /listings/:id.',
      tags: ['Bostad'],
      params: { listingId: z.string() },
      response: {
        200: BostadListingResponseSchema,
        400: ErrorResponseBodySchema,
        401: CoreErrorResponseBodySchema,
        404: CoreErrorResponseBodySchema, // core's, or ours for a listing that is not an apartment
        502: CoreErrorResponseBodySchema, // core 5xx, body kept; or unexpected-core-response
      },
    },
    async (ctx) => {
      const listingId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(ctx.params.listingId)
      if (!listingId.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid-listing-id' }
        return
      }

      const result = await coreClient.request(getAccessToken(ctx), {
        method: 'get',
        path: `/listings/${listingId.data}`,
      })

      if (!result.ok) {
        return forwardCoreError(ctx, result)
      }

      // The page is for apartments; other listings are not found here. Checked
      // before the full parse, since their rental object has another shape.
      const category = z
        .object({
          content: leasing.ListingSchema.pick({ listingCategory: true }),
        })
        .safeParse(result.data)
      if (
        category.success &&
        category.data.content.listingCategory !== 'APARTMENT'
      ) {
        ctx.status = 404
        ctx.body = { error: 'listing-not-found' }
        return
      }

      const parsed = z
        .object({ content: CoreListingSchema })
        .safeParse(result.data)
      if (!parsed.success) {
        ctx.status = 502
        ctx.body = { error: 'unexpected-core-response' }
        return
      }

      ctx.status = 200
      ctx.body = { content: toBostadListing(parsed.data.content) }
    }
  )
}
