import { Offer } from 'onecore-types'

import { db } from './db'
import { DbApplicant, DbOffer } from './types'

import * as dbUtils from './utils'

type CreateOfferParams = Omit<
  Offer,
  'id' | 'sentAt' | 'answeredAt' | 'offeredApplicant' | 'createdAt'
> & { applicantId: number }

export async function create(params: CreateOfferParams) {
  const { selectedApplicants, ...rest } = params
  const values = {
    ...rest,
    selectionSnapshot: JSON.stringify(selectedApplicants),
  }

  const applicant = await db<DbApplicant>('applicant')
    .select('*')
    .where('Id', params.applicantId)
    .first()

  if (!applicant) {
    throw new Error('applicant not found')
  }

  const [offer] = await db<DbOffer>('offer')
    .insert(dbUtils.camelToPascal(values))
    .returning('*')

  return transformFromDbOffer(offer, applicant)
}

const transformFromDbOffer = (o: DbOffer, a: DbApplicant): Offer => {
  const {
    selectionSnapshot: selectedApplicants,
    applicantId: _applicantId,
    ...offer
  } = dbUtils.pascalToCamel(o)

  return {
    ...offer,
    selectedApplicants: JSON.parse(selectedApplicants),
    offeredApplicant: dbUtils.pascalToCamel(a),
  }
}
