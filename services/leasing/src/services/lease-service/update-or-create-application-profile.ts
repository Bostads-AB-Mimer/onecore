import {
  ApplicationProfile,
  ApplicationProfileHousingReference,
  leasing,
} from 'onecore-types'
import { Knex } from 'knex'
import { z } from 'zod'

import { AdapterResult } from './adapters/types'
import * as applicationProfileAdapter from './adapters/application-profile-adapter'
import * as applicationProfileHousingReferenceAdapter from './adapters/application-profile-housing-reference-adapter'

type Params = z.infer<
  typeof leasing.CreateOrUpdateApplicationProfileRequestParamsSchema
>

export async function updateOrCreateApplicationProfile(
  db: Knex,
  contactCode: string,
  params: Params
): Promise<
  AdapterResult<
    [ApplicationProfile, 'created' | 'updated'],
    | 'update-profile'
    | 'update-reference'
    | 'create-profile'
    | 'create-reference'
    | 'unknown'
  >
> {
  const trx = await db.transaction()

  const profileResult = await updateOrCreateProfile(trx, contactCode, params)
  if (!profileResult.ok) {
    await trx.rollback()
    return { ok: false, err: profileResult.err }
  }

  const [profile, operation] = profileResult.data
  if (!params.housingReference) {
    await trx.commit()
    return { ok: true, data: profileResult.data }
  }

  const housingReferenceResult = await updateOrCreateReference(trx, {
    ...params.housingReference,
    applicationProfileId: profile.id,
  })

  if (!housingReferenceResult.ok) {
    await trx.rollback()
    return { ok: false, err: housingReferenceResult.err }
  }

  const [housingReference] = housingReferenceResult.data

  await trx.commit()
  return { ok: true, data: [{ ...profile, housingReference }, operation] }
}

async function updateOrCreateProfile(
  trx: Knex,
  contactCode: string,
  params: Params
): Promise<
  AdapterResult<
    [ApplicationProfile, 'created' | 'updated'],
    'update-profile' | 'create-profile'
  >
> {
  const updateProfile = await applicationProfileAdapter.update(
    trx,
    contactCode,
    params
  )

  if (!updateProfile.ok) {
    if (updateProfile.err !== 'no-update') {
      return { ok: false, err: 'update-profile' }
    }

    const insertProfile = await applicationProfileAdapter.create(trx, {
      contactCode,
      ...params,
    })

    if (!insertProfile.ok) {
      return { ok: false, err: 'create-profile' }
    }

    return { ok: true, data: [insertProfile.data, 'created'] }
  }

  return { ok: true, data: [updateProfile.data, 'updated'] }
}

async function updateOrCreateReference(
  trx: Knex,
  params: Params['housingReference'] & { applicationProfileId: number }
): Promise<
  AdapterResult<
    [ApplicationProfileHousingReference, 'created' | 'updated'],
    'update-reference' | 'create-reference'
  >
> {
  const updateReference =
    await applicationProfileHousingReferenceAdapter.update(
      trx,
      params.applicationProfileId,
      params
    )

  if (!updateReference.ok) {
    if (updateReference.err !== 'no-update') {
      return { ok: false, err: 'update-reference' }
    }

    const insertReference =
      await applicationProfileHousingReferenceAdapter.create(trx, params)

    if (!insertReference.ok) {
      return { ok: false, err: 'create-reference' }
    }

    return { ok: true, data: [insertReference.data, 'created'] }
  }

  return { ok: true, data: [updateReference.data, 'updated'] }
}
