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

  if (!existingProfile.ok) {
    // A new profile is created with expiresAt set to 6 months from now
    params.expiresAt = addMonths(new Date(), 6)
    params.housingReference.expiresAt = addMonths(new Date(), 6)
  } else {
    const hasUpdatedHousingReference =
      existingProfile.data.housingReference.reviewStatus !==
        params.housingReference.reviewStatus ||
      existingProfile.data.housingType !== params.housingType

    if (hasUpdatedHousingReference) {
      params.housingReference.expiresAt = addMonths(new Date(), 6)
    }

    const hasUpdatedApplicationProfile =
      params.housingType !== existingProfile.data.housingType ||
      params.housingTypeDescription !==
        existingProfile.data.housingTypeDescription ||
      params.landlord !== existingProfile.data.landlord ||
      params.numAdults !== existingProfile.data.numAdults ||
      params.numChildren !== existingProfile.data.numChildren ||
      params.lastUpdatedAt !== existingProfile.data.lastUpdatedAt

    if (hasUpdatedApplicationProfile) {
      params.expiresAt = addMonths(new Date(), 6)
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
