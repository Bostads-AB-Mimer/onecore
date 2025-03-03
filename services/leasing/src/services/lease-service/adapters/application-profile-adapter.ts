import { Knex } from 'knex'
import { RequestError } from 'tedious'
import { logger } from 'onecore-utilities'
import { z } from 'zod'

import { AdapterResult } from './types'
import {
  ApplicationProfileHousingReferenceSchema,
  ApplicationProfileSchema,
} from './db-schemas'

type ApplicationProfile = z.infer<typeof ApplicationProfileSchema>

const _CreateParamsSchema = ApplicationProfileSchema.pick({
  numChildren: true,
  numAdults: true,
  expiresAt: true,
  housingType: true,
  housingTypeDescription: true,
  landlord: true,
  lastUpdatedAt: true,
}).extend({
  housingReference: ApplicationProfileHousingReferenceSchema.pick({
    expiresAt: true,
    phone: true,
    email: true,
    reviewStatus: true,
    comment: true,
    reasonRejected: true,
    reviewedAt: true,
    reviewedBy: true,
  }),
})

type CreateParams = z.infer<typeof _CreateParamsSchema>

export async function create(
  db: Knex,
  contactCode: string,
  params: CreateParams
): Promise<
  AdapterResult<ApplicationProfile, 'conflict-contact-code' | 'unknown'>
> {
  try {
    const result = await db.transaction(async (trx) => {
      const [profile] = await trx
        .insert({
          contactCode: contactCode,
          numChildren: params.numChildren,
          numAdults: params.numAdults,
          expiresAt: params.expiresAt,
          housingType: params.housingType,
          housingTypeDescription: params.housingTypeDescription,
          landlord: params.landlord,
          lastUpdatedAt: params.lastUpdatedAt,
        })
        .into('application_profile')
        .returning('*')

      const [reference] = await trx
        .insert({
          applicationProfileId: profile.id,
          phone: params.housingReference.phone,
          email: params.housingReference.email,
          reviewStatus: params.housingReference.reviewStatus,
          comment: params.housingReference.comment,
          reasonRejected: params.housingReference.reasonRejected,
          reviewedAt: params.housingReference.reviewedAt,
          reviewedBy: 'not-implemented',
          expiresAt: params.housingReference.expiresAt,
        })
        .into('application_profile_housing_reference')
        .returning('*')

      return ApplicationProfileSchema.parse({
        ...profile,
        housingReference: reference,
      })
    })

    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof RequestError) {
      if (err.message.includes('UQ_contactCode')) {
        logger.info(
          { contactCode },
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
          SELECT apht2.*
          FROM application_profile_housing_reference apht2
          WHERE apht2.applicationProfileId = ap.id
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
        ) AS housingReference
      FROM application_profile ap
      INNER JOIN application_profile_housing_reference apht ON ap.id = apht.applicationProfileId
      WHERE ap.contactCode = ?
      `,
      [contactCode]
    )

    if (!row) {
      return { ok: false, err: 'not-found' }
    }

    return {
      ok: true,
      data: ApplicationProfileSchema.parse({
        ...row,
        housingReference: JSON.parse(row.housingReference),
      }),
    }
  } catch (err) {
    logger.error(err, 'applicationProfileAdapter.getByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

type UpdateParams = z.infer<typeof _CreateParamsSchema>

export async function update(
  db: Knex,
  contactCode: string,
  params: UpdateParams
): Promise<AdapterResult<ApplicationProfile, 'no-update' | 'unknown'>> {
  try {
    const result = await db.transaction(async (trx) => {
      const [profile] = await db('application_profile')
        .update({
          numChildren: params.numChildren,
          numAdults: params.numAdults,
          expiresAt: params.expiresAt,
          housingType: params.housingType,
          housingTypeDescription: params.housingTypeDescription,
          landlord: params.landlord,
          lastUpdatedAt: params.lastUpdatedAt,
        })
        .where('contactCode', contactCode)
        .returning('*')

      if (!profile) {
        return 'no-update'
      }

      const [reference] = await trx('application_profile_housing_reference')
        .update({
          phone: params.housingReference.phone,
          email: params.housingReference.email,
          reviewStatus: params.housingReference.reviewStatus,
          comment: params.housingReference.comment,
          reasonRejected: params.housingReference.reasonRejected,
          reviewedAt: params.housingReference.reviewedAt,
          expiresAt: params.housingReference.expiresAt,
        })
        .where({ applicationProfileId: profile.id })
        .returning('*')

      if (!reference) {
        logger.error(
          `applicationProfileAdapter.update - no reference found for profile id ${profile.id}`
        )
        return 'missing-reference'
      }

      return ApplicationProfileSchema.parse({
        ...profile,
        housingReference: reference,
      })
    })

    if (result === 'no-update') {
      return { ok: false, err: 'no-update' }
    }

    if (result === 'missing-reference') {
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: result }
  } catch (err) {
    logger.error(err, 'applicationProfileAdapter.update')
    return { ok: false, err: 'unknown' }
  }
}
