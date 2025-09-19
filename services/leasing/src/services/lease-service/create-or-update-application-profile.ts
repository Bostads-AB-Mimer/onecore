import { leasing, ApplicationProfile } from '@onecore/types'
import { Knex } from 'knex'
import { z } from 'zod'

import { AdapterResult } from './adapters/types'
import * as applicationProfileAdapter from './adapters/application-profile-adapter'
import { addMonths } from 'date-fns'

type Params = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema
>

async function create(
  db: Knex,
  contactCode: string,
  params: Params
): Promise<AdapterResult<['created', ApplicationProfile], 'unknown'>> {
  const now = new Date()

  // A new profile is created with expiresAt set to 6 months from now
  if (params.housingReference.reviewStatus !== 'PENDING') {
    params.expiresAt = addMonths(now, 6)
    if (!params.housingReference.expiresAt) {
      params.housingReference.expiresAt = addMonths(now, 6)
    }
  }
  params.lastUpdatedAt = now

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

async function update(
  db: Knex,
  contactCode: string,
  existingProfile: ApplicationProfile,
  params: Params
): Promise<AdapterResult<['updated', ApplicationProfile], 'unknown'>> {
  // If the profile already exists, we need to check if the housing reference
  // or the application profile has been updated and update the expiresAts
  // accordingly
  const now = new Date()

  const hasUpdatedReviewStatus =
    existingProfile.housingReference.reviewStatus !==
    params.housingReference.reviewStatus

  const hasUpdatedApplicationProfile =
    params.housingType !== existingProfile.housingType ||
    params.housingTypeDescription !== existingProfile.housingTypeDescription ||
    params.landlord !== existingProfile.landlord

  const hasUpdatedNumberOfTenants =
    params.numAdults !== existingProfile.numAdults ||
    params.numChildren !== existingProfile.numChildren

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

  const update = await applicationProfileAdapter.update(db, contactCode, params)

  return update.ok
    ? { ok: true, data: ['updated', update.data] }
    : { ok: false, err: 'unknown' }
}

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

  if (!existingProfile.ok) {
    return create(db, contactCode, params)
  } else {
    return update(db, contactCode, existingProfile.data, params)
  }
}
