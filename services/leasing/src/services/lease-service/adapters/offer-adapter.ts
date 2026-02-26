import {
  OfferWithRentalObjectCode,
  Offer,
  Applicant,
  DetailedOffer,
  OfferStatus,
  ApplicantStatus,
  OfferWithOfferApplicants,
  CreateOfferParams,
} from '@onecore/types'
import { logger } from '@onecore/utilities'
import { Knex } from 'knex'

import { db } from './db'
import {
  AdapterResult,
  DbApplicant,
  DbDetailedOffer,
  DbOffer,
  DbOfferApplicant,
} from './types'

import * as dbUtils from './utils'

export async function create(
  db: Knex,
  params: CreateOfferParams
): Promise<
  AdapterResult<Offer, 'no-applicant' | 'no-offer-applicants' | 'unknown'>
> {
  try {
    const applicant = await db<DbApplicant>('applicant')
      .select('*')
      .where('Id', params.applicantId)
      .first()

    if (!applicant) {
      logger.error(
        { applicantId: params.applicantId, listingId: params.listingId },
        'Applicant not found when creating offer'
      )
      return { ok: false, err: 'no-applicant' }
    }

    if (!params.selectedApplicants.length) {
      return { ok: false, err: 'no-offer-applicants' }
    }

    const updateApplicantStatus = params.status == OfferStatus.Active

    if (updateApplicantStatus) {
      // Update the applicant status to "Offered" for the applicant that the offer is being made to
      applicant.Status = ApplicantStatus.Offered
    }

    const offer = await db.transaction(async (trx) => {
      const { selectedApplicants, ...offerParams } = params
      const [offer] = await trx.raw<Array<DbOffer>>(
        `INSERT INTO offer (
          Status,
          ExpiresAt,
          SentAt,
          ListingId,
          ApplicantId
        ) OUTPUT INSERTED.*
        VALUES (?, ?, ?, ?, ?) 
        `,
        [
          offerParams.status,
          offerParams.expiresAt,
          offerParams.sentAt,
          offerParams.listingId,
          offerParams.applicantId,
        ]
      )

      const offerApplicantsValues = selectedApplicants.map((a, i) => [
        offer.Id,
        params.listingId,
        a.applicantId,
        a.status,
        a.applicationType,
        a.queuePoints,
        a.address,
        a.hasParkingSpace,
        a.housingLeaseStatus,
        a.priority,
        i + 1,
      ])

      const placeholders = selectedApplicants
        .map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .join(', ')

      await trx.raw<Array<DbOfferApplicant>>(
        `INSERT INTO offer_applicant (
          offerId,
          listingId,
          applicantId,
          applicantStatus,
          applicantApplicationType,
          applicantQueuePoints,
          applicantAddress,
          applicantHasParkingSpace,
          applicantHousingLeaseStatus,
          applicantPriority,
          sortOrder
        )
        VALUES ${placeholders}`,
        offerApplicantsValues.flat()
      )

      if (updateApplicantStatus) {
        await trx('applicant')
          .where('Id', params.applicantId)
          .update({ Status: applicant.Status })
      }

      return offer
    })

    return {
      ok: true,
      data: {
        id: offer.Id,
        listingId: offer.ListingId,
        status: offer.Status,
        expiresAt: offer.ExpiresAt,
        sentAt: offer.SentAt,
        offeredApplicant: {
          id: applicant.Id,
          name: applicant.Name,
          listingId: applicant.ListingId,
          status: applicant.Status,
          applicationType: applicant.ApplicationType,
          applicationDate: applicant.ApplicationDate,
          contactCode: applicant.ContactCode,
          nationalRegistrationNumber: applicant.NationalRegistrationNumber,
        },
        createdAt: offer.CreatedAt,
        answeredAt: offer.AnsweredAt,
      },
    }
  } catch (err) {
    console.log('err: ', err)
    logger.error(err, 'Error creating offer')
    return { ok: false, err: 'unknown' }
  }
}

type GetOffersForContactQueryResult = Array<
  DbOffer & {
    RentalObjectCode: string
    ApplicantApplicantId: number
    ApplicantName: string
    ApplicantNationalRegistrationNumber: string
    ApplicantContactCode: string
    ApplicantApplicationDate: Date
    ApplicantApplicationType: 'Replace' | 'Additional'
    ApplicantStatus: Applicant['status']
    ApplicantListingId: number
  }
>

export async function getOffersForContact(
  contactCode: string,
  dbConnection = db
): Promise<Array<OfferWithRentalObjectCode>> {
  const rows = await dbConnection
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
      id: offer.Id,
      sentAt: offer.SentAt,
      expiresAt: offer.ExpiresAt,
      answeredAt: offer.AnsweredAt,
      status: offer.Status,
      listingId: offer.ListingId,
      createdAt: offer.CreatedAt,
      offeredApplicant: {
        applicationDate: ApplicantApplicationDate,
        contactCode: ApplicantContactCode,
        id: ApplicantApplicantId,
        listingId: ApplicantListingId,
        name: ApplicantName,
        nationalRegistrationNumber: ApplicantNationalRegistrationNumber,
        status: ApplicantStatus,
        applicationType: ApplicantApplicationType,
      },
      rentalObjectCode: RentalObjectCode,
    }
  })
}

export async function getOfferByContactCodeAndOfferId(
  contactCode: string,
  offerId: number,
  dbConnection: Knex = db
): Promise<DetailedOffer | undefined> {
  const row = await dbConnection
    .select(
      'offer.Id',
      'offer.SentAt',
      'offer.ExpiresAt',
      'offer.AnsweredAt',
      'offer.Status',
      'offer.ListingId',
      'offer.ApplicantId',
      'offer.CreatedAt',
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
    .where('offer.Id', offerId)
    .andWhere('applicant.ContactCode', contactCode)
    .first()

  if (row == undefined) {
    logger.info(
      { offerId },
      'Getting offer from leasing DB complete - offer not found'
    )
    return undefined
  }
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
    ...transformToDetailedOfferFromDbOffer(offer, {
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
}

export async function getOfferByOfferId(
  offerId: number,
  dbConnection = db
): Promise<AdapterResult<DetailedOffer, 'not-found' | 'unknown'>> {
  try {
    const row = await dbConnection
      .select(
        'offer.Id',
        'offer.SentAt',
        'offer.ExpiresAt',
        'offer.AnsweredAt',
        'offer.Status',
        'offer.ListingId',
        'offer.ApplicantId',
        'offer.CreatedAt',
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
      .where('offer.Id', offerId)
      .first()

    if (row == undefined) {
      logger.info(
        { offerId },
        'Getting offer from leasing DB complete - offer not found'
      )
      return { ok: false, err: 'not-found' }
    }
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
      ok: true,
      data: {
        ...transformToDetailedOfferFromDbOffer(offer, {
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
      },
    }
  } catch (error) {
    logger.error(error, 'Error getting offer by offer id')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateOfferAnsweredStatus(
  params: {
    offerId: number
    status: OfferStatus
    answeredAt: Date
  },
  dbConnection: Knex = db
): Promise<AdapterResult<null, 'no-update' | 'unknown'>> {
  try {
    const query = await dbConnection('offer')
      .update({ Status: params.status, AnsweredAt: params.answeredAt })
      .where({ Id: params.offerId })

    if (!query) {
      return { ok: false, err: 'no-update' }
    }
    return { ok: true, data: null }
  } catch (err) {
    logger.error(err, 'Error updating offer status')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateOfferApplicant(
  db: Knex,
  params: {
    offerId: number
    listingId: number
    applicantId: number
    applicantStatus: ApplicantStatus
  }
): Promise<AdapterResult<null, 'no-update' | 'unknown'>> {
  try {
    const query = await db('offer_applicant')
      .update({ applicantStatus: params.applicantStatus })
      .where({
        offerId: params.offerId,
        listingId: params.listingId,
        applicantId: params.applicantId,
      })

    if (!query) {
      return { ok: false, err: 'no-update' }
    }

    return { ok: true, data: null }
  } catch (err) {
    logger.error(err, 'Error updating offer applicant')
    return { ok: false, err: 'unknown' }
  }
}

type OffersWithOfferApplicantsQueryResult = DbOffer & {
  offerApplicants: string
  offeredApplicant: string
}

export async function getOffersWithOfferApplicantsByListingId(
  db: Knex,
  listingId: number
): Promise<AdapterResult<Array<OfferWithOfferApplicants>, 'unknown'>> {
  try {
    const rows = await db.raw<Array<OffersWithOfferApplicantsQueryResult>>(
      `
      SELECT DISTINCT
        o.*,
        (
          SELECT a.*
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS offeredApplicant,
        (
          SELECT 
            oa.*,
            app.ApplicationDate AS applicantApplicationDate,
            app.Name AS applicantName,
            app.ContactCode AS applicantContactCode,
            app.NationalRegistrationNumber AS applicantNationalRegistrationNumber
          FROM offer_applicant oa
          INNER JOIN applicant app ON oa.applicantId = app.Id
          WHERE oa.offerId = o.Id
          ORDER BY oa.sortOrder ASC
          FOR JSON PATH
        ) AS offerApplicants
      FROM offer o
      INNER JOIN applicant a ON o.ApplicantId = a.Id
      INNER JOIN offer_applicant oa ON o.Id = oa.offerId
      WHERE o.ListingId = ?
      ORDER BY o.CreatedAt ASC
    `,
      [listingId]
    )

    const mappedRows = rows.map(transformOfferWithOfferApplicantsQueryResult)

    return {
      ok: true,
      data: mappedRows,
    }
  } catch (err) {
    logger.error(err, 'Error getting offers by listing ID')
    return { ok: false, err: 'unknown' }
  }
}

export async function getActiveOfferByListingId(
  db: Knex,
  listingId: number
): Promise<AdapterResult<Offer | null, 'unknown'>> {
  try {
    const [row] = await db.raw<
      Array<
        | (DbOffer & {
            offeredApplicant: string
          })
        | null
      >
    >(
      `
      SELECT TOP 1 o.*,
      (
        SELECT a.*
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
      ) AS offeredApplicant
      FROM offer o
      INNER JOIN applicant a ON o.ApplicantId = a.Id
      WHERE o.ListingId = ? AND o.Status = ?
    `,
      [listingId, OfferStatus.Active]
    )

    if (!row) {
      return { ok: true, data: null }
    }

    const offeredApplicant = JSON.parse(row.offeredApplicant) as DbApplicant
    return {
      ok: true,
      data: {
        id: row.Id,
        sentAt: row.SentAt,
        expiresAt: row.ExpiresAt,
        answeredAt: row.AnsweredAt,
        status: row.Status,
        listingId: row.ListingId,
        createdAt: row.CreatedAt,
        offeredApplicant: {
          id: offeredApplicant.Id,
          name: offeredApplicant.Name,
          listingId: offeredApplicant.ListingId,
          status: offeredApplicant.Status,
          applicationType: offeredApplicant.ApplicationType,
          applicationDate: new Date(offeredApplicant.ApplicationDate),
          contactCode: offeredApplicant.ContactCode,
          nationalRegistrationNumber:
            offeredApplicant.NationalRegistrationNumber,
        },
      },
    }
  } catch (err) {
    logger.error(err, 'offerAdapter.getActiveOfferByListingId')
    return { ok: false, err: 'unknown' }
  }
}

export const handleExpiredOffers = async (): Promise<
  AdapterResult<number[] | null, 'unknown'>
> => {
  try {
    const dbOffers = await db
      .select(
        'offer.Id',
        'offer.SentAt',
        'offer.ExpiresAt',
        'offer.AnsweredAt',
        'offer.Status',
        'offer.ListingId',
        'offer.ApplicantId',
        'offer.CreatedAt'
      )
      .from('offer')
      .where('offer.AnsweredAt', null)
      .andWhere('offer.ExpiresAt', '<', new Date())
      .andWhere('offer.Status', OfferStatus.Active)

    for (const dbOffer of dbOffers) {
      logger.info(null, 'Handling offer ' + dbOffer.Id)
      await db('offer')
        .update({ Status: OfferStatus.Expired, AnsweredAt: new Date() })
        .where('offer.Id', dbOffer.Id)

      await db('offer_applicant')
        .update({
          ApplicantStatus: ApplicantStatus.OfferExpired,
        })
        .where('offer_applicant.applicantId', dbOffer.ApplicantId)
    }

    return {
      ok: true,
      data: dbOffers.map((dbOffer) => dbOffer.ListingId),
    }
  } catch (error) {
    logger.error(error, 'Error getting expired offers')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateOfferSentAt(
  db: Knex,
  offerId: number,
  sentAt: Date
): Promise<AdapterResult<null, 'no-update' | 'unknown'>> {
  try {
    const update = await db('offer')
      .update({ SentAt: sentAt })
      .where('Id', offerId)

    if (!update) {
      logger.info(
        { offerId },
        'offerAdapter.updateOfferSentAt -- No offer updated'
      )
      return { ok: false, err: 'no-update' }
    }

    return { ok: true, data: null }
  } catch (err) {
    logger.error(err, 'offerAdapter.updateOfferSentAt')
    return { ok: false, err: 'unknown' }
  }
}

const transformOfferWithOfferApplicantsQueryResult = (
  result: OffersWithOfferApplicantsQueryResult
): OfferWithOfferApplicants => {
  const offeredApplicant = JSON.parse(result.offeredApplicant) as DbApplicant
  const offerApplicants = (JSON.parse(result.offerApplicants) ?? []) as Array<
    DbOfferApplicant & {
      applicantName: string
      applicantApplicationDate: string
    }
  >

  return {
    id: result.Id,
    sentAt: result.SentAt,
    expiresAt: result.ExpiresAt,
    answeredAt: result.AnsweredAt,
    status: result.Status,
    listingId: result.ListingId,
    createdAt: result.CreatedAt,
    offeredApplicant: {
      id: offeredApplicant.Id,
      name: offeredApplicant.Name,
      listingId: offeredApplicant.ListingId,
      status: offeredApplicant.Status,
      applicationType: offeredApplicant.ApplicationType,
      applicationDate: new Date(offeredApplicant.ApplicationDate),
      contactCode: offeredApplicant.ContactCode,
      nationalRegistrationNumber: offeredApplicant.NationalRegistrationNumber,
    },
    selectedApplicants: offerApplicants.map((a) => ({
      id: a.id,
      listingId: a.listingId,
      offerId: a.offerId,
      applicantId: a.applicantId,
      status: a.applicantStatus,
      applicationType: a.applicantApplicationType,
      queuePoints: a.applicantQueuePoints,
      address: a.applicantAddress,
      hasParkingSpace: a.applicantHasParkingSpace,
      housingLeaseStatus: a.applicantHousingLeaseStatus,
      priority: a.applicantPriority,
      sortOrder: a.sortOrder,
      createdAt: new Date(a.createdAt),
      applicationDate: new Date(a.applicantApplicationDate),
      name: a.applicantName,
      contactCode: a.applicantContactCode,
      nationalRegistrationNumber: a.applicantNationalRegistrationNumber,
    })),
  }
}

const transformToDetailedOfferFromDbOffer = (
  o: DbDetailedOffer,
  a: DbApplicant
): DetailedOffer => {
  const { applicantId: _applicantId, ...offer } = dbUtils.pascalToCamel(o)
  return {
    ...offer,
    offeredApplicant: {
      ...dbUtils.pascalToCamel(a),
      applicationType: a.ApplicationType,
    },
  }
}
