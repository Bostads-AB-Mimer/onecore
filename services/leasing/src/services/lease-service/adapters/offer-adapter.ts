import { OfferWithRentalObjectCode, Offer, Applicant } from 'onecore-types'

import { db } from './db'
import { DbApplicant, DbOffer } from './types'

import * as dbUtils from './utils'
import { logger } from 'onecore-utilities'

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
    logger.error(
      { applicantId: params.applicantId, listingId: params.listingId },
      'Applicant not found when creating offer'
    )
    throw new Error('Applicant not found when creating offer')
  }

  const [offer] = await db<DbOffer>('offer')
    .insert(dbUtils.camelToPascal(values))
    .returning('*')

  return transformFromDbOffer(offer, applicant)
}

export async function getOffersForContact(
  contactCode: string
): Promise<Array<OfferWithRentalObjectCode>> {
  const rows = await db
    .select(
      'offer.*',
      'listing.RentalObjectCode',
      'applicant.Id as ApplicantApplicantId',
      'applicant.Name as ApplicantName',
      'applicant.NationalRegistrationNumber as ApplicantNationalRegistrationNumber',
      'applicant.ContactCode as ApplicantContactCode',
      'applicant.ApplicationDate as ApplicantApplicationDate',
      'applicant.ApplicationType as ApplicantApplicationType',
      'applicant.Status as ApplicantStatus',
      'applicant.ListingId as ApplicantListingId'
    )
    .from('offer')
    .innerJoin('listing', 'listing.Id', 'offer.ListingId')
    .innerJoin('applicant', 'applicant.Id', 'offer.ApplicantId')
    .where('applicant.ContactCode', contactCode)

  return rows.map((row) => transformToOfferWithRentalObjectCode(row))
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

const transformToOfferWithRentalObjectCode = (
  result: any
): OfferWithRentalObjectCode => {
  const applicant: Applicant = {
    id: result.ApplicantApplicantId,
    name: result.ApplicantName,
    nationalRegistrationNumber: result.ApplicantNationalRegistrationNumber,
    contactCode: result.ApplicantContactCode,
    applicationDate: result.ApplicantApplicationDate,
    applicationType: result.ApplicantApplicationType,
    status: result.ApplicantStatus,
    listingId: result.ApplicantListingId,
  }
  const offerWithRentalObjectCode: OfferWithRentalObjectCode = {
    id: result.Id,
    sentAt: result.SentAt,
    expiresAt: result.ExpiresAt,
    answeredAt: result.AnsweredAt,
    selectedApplicants: JSON.parse(result.SelectionSnapshot),
    status: result.Status,
    listingId: result.ListingId,
    offeredApplicant: applicant,
    createdAt: result.CreatedAt,
    rentalObjectCode: result.RentalObjectCode,
  }

  return offerWithRentalObjectCode
}
