import { Knex } from 'knex'
import { RequestError } from 'tedious'
import { logger } from 'onecore-utilities'
import { ApplicationProfile } from 'onecore-types'

import { AdapterResult } from './types'

type CreateParams = {
  contactCode: string
  numAdults: number
  numChildren: number
  expiresAt: Date | null
  housingType?: string
  housingTypeDescription?: string
  landlord?: string
}

export async function create(
  db: Knex,
  params: CreateParams
): Promise<
  AdapterResult<ApplicationProfile, 'conflict-contact-code' | 'unknown'>
> {
  try {
    const [profile] = await db
      .insert({
        contactCode: params.contactCode,
        numChildren: params.numChildren,
        numAdults: params.numAdults,
        expiresAt: params.expiresAt,
        housingType: params.housingType,
        housingTypeDescription: params.housingTypeDescription,
        landlord: params.landlord,
      })
      .into('application_profile')
      .returning('*')

    return { ok: true, data: profile }
  } catch (err) {
    if (err instanceof RequestError) {
      if (err.message.includes('UQ_contactCode')) {
        logger.info(
          { contactCode: params.contactCode },
          'applicationProfileAdapter.create - can not insert duplicate application profile'
        )
        return { ok: false, err: 'conflict-contact-code' }
      }
    }

    logger.error(err, 'applicationProfileAdapter.create')
    return { ok: false, err: 'unknown' }
  }
}

export async function getByContactCode(
  db: Knex,
  contactCode: string
): Promise<AdapterResult<ApplicationProfile, 'not-found' | 'unknown'>> {
  try {
    const [row] = await db.raw(
      `
      SELECT 
        ap.*,
        (
          SELECT apht.* 
          FROM application_profile_housing_reference apht
          WHERE apht.applicationProfileId = ap.id
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
        ) AS housingReference
      FROM application_profile ap
      WHERE ap.contactCode = ?
  `,
      [contactCode]
    )

    if (!row) {
      return { ok: false, err: 'not-found' }
    }

    const housingReference = row.housingReference
      ? JSON.parse(row.housingReference)
      : undefined

    return {
      ok: true,
      data: {
        ...row,
        housingReference: housingReference
          ? {
              ...housingReference,
              expiresAt: new Date(housingReference.expiresAt),
              createdAt: new Date(housingReference.createdAt),
              reviewedAt: housingReference.reviewedAt
                ? new Date(housingReference.reviewedAt)
                : null,
            }
          : undefined,
        housingType: row.housingType || undefined,
        housingTypeDescription: row.housingTypeDescription || undefined,
        landlord: row.landlord || undefined,
      },
    }
  } catch (err) {
    logger.error(err, 'applicationProfileAdapter.getByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

type UpdateParams = {
  numChildren: number
  numAdults: number
  expiresAt: Date | null
  housingType?: string
  housingTypeDescription?: string
  landlord?: string
}

export async function update(
  db: Knex,
  contactCode: string,
  params: UpdateParams
): Promise<AdapterResult<ApplicationProfile, 'no-update' | 'unknown'>> {
  try {
    const [profile] = await db('application_profile')
      .update({
        numChildren: params.numChildren,
        numAdults: params.numAdults,
        expiresAt: params.expiresAt,
        housingType: params.housingType,
        housingTypeDescription: params.housingTypeDescription,
        landlord: params.landlord,
      })
      .where('contactCode', contactCode)
      .returning('*')

    if (!profile) {
      return { ok: false, err: 'no-update' }
    }

    return { ok: true, data: profile }
  } catch (err) {
    logger.error(err, 'applicationProfileAdapter.update')
    return { ok: false, err: 'unknown' }
  }
}
