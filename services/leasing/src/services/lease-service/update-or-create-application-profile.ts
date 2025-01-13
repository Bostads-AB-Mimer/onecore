import { ApplicationProfile, leasing } from 'onecore-types'
import { Knex } from 'knex'
import { z } from 'zod'

import { AdapterResult } from './adapters/types'
import * as applicationProfileAdapter from './adapters/application-profile-adapter'

type Params = z.infer<
  typeof leasing.CreateOrUpdateApplicationProfileRequestParamsSchema
>

export async function updateOrCreateApplicationProfile(
  db: Knex,
  contactCode: string,
  params: Params
): Promise<
  AdapterResult<['created' | 'updated', ApplicationProfile], 'unknown'>
> {
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
