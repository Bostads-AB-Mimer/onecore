import { schemas, leasing } from 'onecore-types'
import { Knex } from 'knex'
import { z } from 'zod'

import { AdapterResult } from './adapters/types'
import * as applicationProfileAdapter from './adapters/application-profile-adapter'
import { addMonths } from 'date-fns'

type Params = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema
>

type ApplicationProfile = z.infer<typeof schemas.v1.ApplicationProfileSchema>

export async function createOrUpdateApplicationProfile(
  db: Knex,
  contactCode: string,
  params: Params
): Promise<
  AdapterResult<['created' | 'updated', ApplicationProfile], 'unknown'>
> {
  const existingProfile = await applicationProfileAdapter.getByContactCode(
    db,
    contactCode
  )

  const now = new Date()

  if (!existingProfile.ok) {
    // A new profile is created with expiresAt set to 6 months from now
    if (params.housingReference.reviewStatus !== 'PENDING') {
      params.expiresAt = addMonths(now, 6)
      if (!params.housingReference.expiresAt) {
        params.housingReference.expiresAt = addMonths(now, 6)
      }
    }
    params.lastUpdatedAt = now
    // If the profile already exists, we need to check if the housing reference
  } else {
    // or the application profile has been updated and update the expiresAts
    // accordingly
    const hasUpdatedReviewStatus =
      existingProfile.data.housingReference.reviewStatus !==
      params.housingReference.reviewStatus

    const hasUpdatedApplicationProfile =
      params.housingType !== existingProfile.data.housingType ||
      params.housingTypeDescription !==
        existingProfile.data.housingTypeDescription ||
      params.landlord !== existingProfile.data.landlord

    const hasUpdatedNumberOfTenants =
      params.numAdults !== existingProfile.data.numAdults ||
      params.numChildren !== existingProfile.data.numChildren

    if (hasUpdatedApplicationProfile) {
      params.lastUpdatedAt = now
    }

    if (hasUpdatedApplicationProfile || hasUpdatedNumberOfTenants) {
      params.expiresAt = addMonths(now, 6)
    }

    // If housingReference.expiresAt is not set and the housingReference
    // has been updated, we set it to 6 months from now
    if (!params.housingReference.expiresAt) {
      if (hasUpdatedReviewStatus) {
        params.housingReference.expiresAt = addMonths(now, 6)
      }
    }

    if (hasUpdatedReviewStatus) {
      params.housingReference.reviewedAt = now
    }
  }

  const update = await applicationProfileAdapter.update(db, contactCode, params)

  if (!update.ok) {
    if (update.err !== 'no-update') {
      return { ok: false, err: 'unknown' }
    }
    const profile = await applicationProfileAdapter.create(
      db,
      contactCode,
      params
    )

    if (!profile.ok) {
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: ['created', profile.data] }
  }

  return { ok: true, data: ['updated', update.data] }
}
