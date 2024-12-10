import { Knex } from 'knex'
import { logger } from 'onecore-utilities'
import { ApplicationProfileHousingReference } from 'onecore-types'

import { AdapterResult } from './types'
import { RequestError } from 'tedious'

type CreateParams = Omit<ApplicationProfileHousingReference, 'id' | 'createdAt'>

export async function create(
  db: Knex,
  params: CreateParams
): Promise<
  AdapterResult<
    ApplicationProfileHousingReference,
    'conflict-application-profile-id' | 'unknown'
  >
> {
  try {
    const [row] = await db
      .insert({
        applicationProfileId: params.applicationProfileId,
        phone: params.phone,
        email: params.email,
        reviewStatus: params.reviewStatus,
        reviewStatusReason: params.reviewStatusReason,
        reviewedAt: params.reviewedAt,
        expiresAt: params.expiresAt,
      })
      .into('application_profile_housing_reference')
      .returning('*')

    return { ok: true, data: row }
  } catch (err) {
    if (err instanceof RequestError) {
      if (err.message.includes('UQ_applicationProfileId')) {
        logger.info(
          { applicationProfileId: params.applicationProfileId },
          'ApplicationProfileHousingReferenceAdapter.create - can not insert duplicate application profile id'
        )
        return { ok: false, err: 'conflict-application-profile-id' }
      }
    }

    logger.error(err, 'applicationProfileAdapter.create')
    return { ok: false, err: 'unknown' }
  }
}

export async function findByApplicationProfileId(
  db: Knex,
  applicationProfileId: number
): Promise<
  AdapterResult<ApplicationProfileHousingReference, 'not-found' | 'unknown'>
> {
  try {
    const [row] = await db
      .select('*')
      .from('application_profile_housing_reference')
      .where('applicationProfileId', applicationProfileId)
      .returning('*')

    if (!row) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: true, data: row }
  } catch (err) {
    logger.error(
      err,
      'ApplicationProfileHousingReferenceAdapter.findByApplicationProfileId'
    )
    return { ok: false, err: 'unknown' }
  }
}

type UpdateParams = Omit<
  ApplicationProfileHousingReference,
  'id' | 'createdAt' | 'applicationProfileId'
>

export async function update(
  db: Knex,
  applicationProfileId: number,
  params: UpdateParams
): Promise<
  AdapterResult<ApplicationProfileHousingReference, 'no-update' | 'unknown'>
> {
  try {
    const [row] = await db('application_profile_housing_reference')
      .update({
        phone: params.phone,
        email: params.email,
        reviewStatus: params.reviewStatus,
        reviewStatusReason: params.reviewStatusReason,
        reviewedAt: params.reviewedAt,
        expiresAt: params.expiresAt,
      })
      .where('applicationProfileId', applicationProfileId)
      .returning('*')

    if (!row) {
      return { ok: false, err: 'no-update' }
    }

    return { ok: true, data: row }
  } catch (err) {
    logger.error(err, 'applicationProfileHousingReferenceAdapter.update')
    return { ok: false, err: 'unknown' }
  }
}
