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

export async function updateOrCreateApplicationProfile(
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

  if (params.housingReference.expiresAt === null) {
    if (existingProfile.ok) {
      if (
        existingProfile.data.housingReference.reviewStatus !==
          params.housingReference.reviewStatus ||
        existingProfile.data.housingType !== params.housingType
      ) {
        params.housingReference.expiresAt = addMonths(new Date(), 6)
      }
    } else {
      params.housingReference.expiresAt = addMonths(new Date(), 6)
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
