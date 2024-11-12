import { Knex } from 'knex'
import { AdapterResult } from './types'
import { logger } from 'onecore-utilities'
import { RequestError } from 'tedious'
import { ApplicationProfile } from 'onecore-types'

type CreateParams = {
  contactCode: string
  numAdults: number
  numChildren: number
  expiresAt: Date | null
}

export async function create(
  db: Knex,
  params: CreateParams
): Promise<
  AdapterResult<ApplicationProfile, 'conflict-contact-code' | 'unknown'>
> {
  try {
    const [profile] = await db
      .insert(params)
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
    const [profile] = await db
      .select('*')
      .from('application_profile')
      .where('contactCode', contactCode)
      .returning('*')

    if (!profile) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: true, data: profile }
  } catch (err) {
    logger.error(err, 'applicationProfileAdapter.getByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

export async function update(
  db: Knex,
  contactCode: string,
  params: {
    numChildren: number
    numAdults: number
    expiresAt: Date | null
  }
): Promise<AdapterResult<ApplicationProfile, 'no-update' | 'unknown'>> {
  try {
    const [profile] = await db('application_profile')
      .update(params)
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
