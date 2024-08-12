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

type GetOffersForContactQueryResult = Array<
  DbOffer & {
    RentalObjectCode: string
    ApplicantApplicantId: number
    ApplicantName: string
    ApplicantNationalRegistrationNumber: string
    ApplicantContactCode: string
    ApplicantApplicationDate: Date
    ApplicantApplicationType: string | null
    ApplicantStatus: Applicant['status']
    ApplicantListingId: number
  }
>

export async function getOffersForContact(
  contactCode: string
): Promise<Array<OfferWithRentalObjectCode>> {
  const rows = await db
    .select<GetOffersForContactQueryResult>(
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

  return rows.map((row) => {
    const {
      ApplicantApplicantId,
      ApplicantName,
      ApplicantNationalRegistrationNumber,
      ApplicantApplicationDate,
      ApplicantApplicationType,
      ApplicantContactCode,
      ApplicantStatus,
      ApplicantListingId,
      RentalObjectCode,
      ...offer
    } = row

    return {
      ...transformFromDbOffer(offer, {
        ApplicationDate: ApplicantApplicationDate,
        ContactCode: ApplicantContactCode,
        Id: ApplicantApplicantId,
        ListingId: ApplicantListingId,
        Name: ApplicantName,
        NationalRegistrationNumber: ApplicantNationalRegistrationNumber,
        Status: ApplicantStatus,
        ApplicationType: ApplicantApplicationType,
      }),
      rentalObjectCode: RentalObjectCode,
    }
  })
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
    offeredApplicant: {
      ...dbUtils.pascalToCamel(a),
      applicationType: a.ApplicationType || undefined,
    },
  }
}
