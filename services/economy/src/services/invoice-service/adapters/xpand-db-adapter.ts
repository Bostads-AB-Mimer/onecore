import knex from 'knex'
import { Address } from '@onecore/types'
import { logger } from '@onecore/utilities'

import config, { isRentalObjectRequirementException } from '@src/common/config'
import {
  InvoiceDeliveryMethod,
  XpandContact,
} from '@src/common/types'
import { mapContactFlags } from '@src/services/common/adapters/xpand-db-adapter'
import {
  InvoiceRowWithAccounting,
  InvoiceWithAccounting,
  RentalBlockWithAccounting,
} from '@src/common/types/typesv2'

type RentalSpecificRule = {
  costCode: string
  property: string
  projectCode?: string
  freeCode?: string
}

type RentalSpecificRules = Record<string, RentalSpecificRule>

type RoundOffInformation = {
  account: string
  costCode: string
}

const db = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
    requestTimeout: 120000,
  },
  pool: { min: 0, max: 10 },
  client: 'mssql',
})

export const enrichInvoiceWithAccounting = async (
  invoice: InvoiceWithAccounting
): Promise<InvoiceWithAccounting> => {
  const year = invoice.invoiceDate.getFullYear()
  const rentalIds = invoice.invoiceRows
    .map((invoiceRow: InvoiceRowWithAccounting) => invoiceRow.rentalObject)
    .filter((rentalObject): rentalObject is string => Boolean(rentalObject))
  const rentalSpecificRules = await getRentalSpecificRules(
    rentalIds,
    year.toString()
  )

  for (const invoiceRow of invoice.invoiceRows) {
    // Rows exempt from the rental object requirement (e.g. invoice fees) have
    // no rental object and therefore no rental-specific accounting rules to
    // apply. Their accounting is resolved from the article configuration.
    if (!invoiceRow.rentalObject) {
      if (isRentalObjectRequirementException(invoiceRow.rentArticleName)) {
        continue
      }

      logger.error(
        { invoiceNumber: invoice.invoiceId },
        'Invoice row is missing a rental object'
      )
      throw new Error(
        `Minst en hyresrad på avin ${invoice.invoiceId} saknar hyresobjekt`
      )
    }

    const rentalSpecificRule = rentalSpecificRules[invoiceRow.rentalObject]
    if (!rentalSpecificRule || Object.keys(rentalSpecificRule).length === 0) {
      logger.error(
        {
          invoiceNumber: invoice.invoiceId,
          rentalSpecificRules,
          rentalObject: invoiceRow.rentalObject,
        },
        'Could not get accounting rules for invoice from Xpand'
      )
      throw new Error(
        `Kunde inte hitta konteringsregler för hyresobjektet ${invoiceRow.rentalObject} på faktura ${invoice.invoiceId}`
      )
    }
    invoiceRow.projectCode =
      invoiceRow.projectCode ?? rentalSpecificRule?.projectCode
    invoiceRow.costCode = invoiceRow.costCode ?? rentalSpecificRule?.costCode
    invoiceRow.property = invoiceRow.property ?? rentalSpecificRule?.property
    invoiceRow.freeCode = invoiceRow.freeCode ?? rentalSpecificRule?.freeCode
  }

  return invoice
}

let roundOffInformation: RoundOffInformation | undefined = undefined

export const getRoundOffInformation = async (
  year: string
): Promise<RoundOffInformation> => {
  if (roundOffInformation === undefined) {
    const roundOffInformationDb = await db('repsk')
      .where('keycode', 'ORESUTJ')
      .andWhere('year', year)
      .distinct()

    roundOffInformation = {
      account: roundOffInformationDb[0]['p1']?.toString().trimEnd(),
      costCode: roundOffInformationDb[0]['p2']?.toString().trimEnd(),
    }
  }

  if (roundOffInformation !== undefined) {
    return roundOffInformation
  } else {
    logger.error({ year }, 'Round off information not found')
    throw Error(`Round off information not found for ${year}`)
  }
}

export const getRentalSpecificRules = async (
  rentalIds: string[],
  year: string
) => {
  const specificRules: RentalSpecificRules = {}

  // SQL Server tillåter max ~2100 parametrar per fråga, så hyresid-listan
  // måste köras i bitar.
  const chunkSize = 1000
  const chunks: string[][] = []
  for (let i = 0; i < rentalIds.length; i += chunkSize) {
    chunks.push(rentalIds.slice(i, i + chunkSize))
  }

  for (const chunk of chunks) {
    const specificRulesBuildingsQuery = db('repsk')
      .innerJoin('babyg', 'babyg.keybabyg', 'repsk.keycode')
      .innerJoin('babuf', 'babyg.keycmobj', 'babuf.keyobjbyg')
      .where('year', year)
      .andWhereLike('keyrektk', 'INTAKT%')
      .whereIn('hyresid', chunk)
      .distinct()

    const specificRulesBuildings = await specificRulesBuildingsQuery

    specificRulesBuildings.forEach((row) => {
      specificRules[row['hyresid'].toString().trimEnd()] = {
        costCode: row['p2'].toString().trimEnd(),
        property: row['p3'].toString().trimEnd(),
      }
    })

    const specificRulesAreasQuery = db('repsk')
      .innerJoin('bayta', 'bayta.keybayta', 'repsk.keycode')
      .innerJoin('babuf', 'bayta.keycmobj', 'babuf.keyobjyta')
      .where('year', year)
      .andWhereLike('keyrektk', 'INTAKT%')
      .whereIn('hyresid', chunk)
      .distinct()

    const specificRulesAreas = await specificRulesAreasQuery

    specificRulesAreas.forEach((row) => {
      specificRules[row['hyresid'].toString().trimEnd()] = {
        costCode: row['p2']?.toString().trimEnd(),
        property: row['p3']?.toString().trimEnd(),
      }
    })
  }

  return specificRules
}

export const getContacts = async (
  contactCodes: string[]
): Promise<XpandContact[]> => {
  const contactQuery = db
    .from('cmctc')
    .select(
      'cmctc.cmctckod as contactCode',
      'cmctc.fnamn as firstName',
      'cmctc.enamn as lastName',
      'cmctc.cmctcben as fullName',
      'cmctc.persorgnr as nationalRegistrationNumber',
      'cmctc.birthdate as birthDate',
      'cmctc.keycmobj as keycmobj',
      'cmctc.keycmctc as contactKey',
      'cmctc.lagsokt as protectedIdentity',
      'krknr.autogiro as autogiro',
      'krknr.stopdate as autogiroCancelledAt',
      'cmctc.avliden as deceased',
      'cmctc.konkurs as emigrated',
      'cmctc.blockinfo as noAdvertising'
    )
    .leftJoin('krknr', 'cmctc.keycmctc', 'krknr.keycmctc')

  const rows = await contactQuery
    .distinct()
    .whereIn('cmctc.cmctckod', contactCodes)

  const emailAddresses = await db('cmeml')
    .select('cmemlben', 'cmctckod')
    .innerJoin('cmctc', 'cmeml.keycmobj', 'cmctc.keycmobj')
    .whereIn('cmctckod', contactCodes)
    .orderBy('main', 'desc')

  const invoiceAddresses = await db('cmadr')
    .select('cmctckod', 'adress1', 'adress3', 'adress4')
    .innerJoin('cmctc', 'cmadr.keycode', 'cmctc.keycmobj')
    .whereIn('cmctckod', contactCodes)
    .orderBy('cmctckod', 'asc')
    .orderBy('fdate', 'desc')
    .orderBy('tdate', 'desc')

  const getContactEmail = (contactCode: string): string => {
    const emailAddress = emailAddresses.find((emailAddress) => {
      return (
        emailAddress['cmctckod'] &&
        emailAddress['cmctckod'].localeCompare(contactCode) === 0
      )
    })

    return emailAddress?.cmemlben ? emailAddress.cmemlben?.trimEnd() : ''
  }

  const getContactAddress = (contactCode: string): Address => {
    const invoiceAddress = invoiceAddresses.find((invoiceAddress) => {
      return (
        invoiceAddress['cmctckod'] &&
        invoiceAddress['cmctckod'].localeCompare(contactCode) === 0
      )
    })

    if (invoiceAddress) {
      return {
        street: invoiceAddress.adress1?.trimEnd(),
        postalCode: invoiceAddress.adress3?.trimEnd(),
        city: invoiceAddress.adress4?.trimEnd(),
        number: '',
      }
    } else {
      return {
        street: '',
        postalCode: '',
        number: '',
        city: '',
      }
    }
  }

  const contacts = rows.map((contactRow) => {
    let nationalRegistrationNumber =
      contactRow.nationalRegistrationNumber?.trimEnd()

    if (nationalRegistrationNumber) {
      if (nationalRegistrationNumber.length > 11) {
        nationalRegistrationNumber = nationalRegistrationNumber.substring(2)
      }

      nationalRegistrationNumber =
        nationalRegistrationNumber.substring(
          0,
          nationalRegistrationNumber.length - 4
        ) +
        '-' +
        nationalRegistrationNumber.substring(
          nationalRegistrationNumber.length - 4
        )
    }

    const contactCode = contactRow.contactCode?.trimEnd()
    const emailAddress = getContactEmail(contactCode)

    const { protectedIdentity, deceased, emigrated, noAdvertising } =
      mapContactFlags(contactRow)

    return {
      contactCode: contactRow.contactCode?.trimEnd(),
      contactKey: contactRow.contactKey?.trimEnd(),
      firstName: contactRow.firstName?.trimEnd(),
      lastName: contactRow.lastName?.trimEnd(),
      fullName: contactRow.fullName?.trimEnd(),
      nationalRegistrationNumber,
      birthDate: contactRow.birthDate,
      isTenant: true,
      address: getContactAddress(contactCode),
      phoneNumbers: undefined,
      emailAddress: emailAddress,
      autogiro:
        contactRow.autogiro &&
        contactRow.autogiro !== 0 &&
        contactRow.autogiroCancelledAt === null,
      invoiceDeliveryMethod:
        emailAddress !== ''
          ? InvoiceDeliveryMethod.Email
          : InvoiceDeliveryMethod.Other,
      protectedIdentity,
      deceased,
      emigrated,
      noAdvertising,
    }
  })

  return contacts
}

const transformRentalBlockWithAccounting = (dbRow: any): RentalBlockWithAccounting => {
  return {
    account: dbRow.p1.trim(),
    costCode: dbRow.p2?.toString().trimEnd(),
    property: dbRow.p3?.toString().trimEnd(),
    projectCode: dbRow.p4?.toString().trimEnd(),
    freeCode: dbRow.p5?.toString().trimEnd(),
    description: dbRow.caption?.toString().trimEnd(),
    fromDate: dbRow.fromDate,
    toDate: dbRow.toDate
  }
}

/**
 * Returns an active rental block with accounting information for a given rental object, if the 
 * block is active within the date range and has accounting information. Rental blocks without
 * accounting information are not returned even if they are active within the date range.
 */
export const getActiveRentalBlocksWithAccounting = async (rentalId: string, from: Date, to: Date) => {
  const year = from.toISOString().substring(0, 4)

  const blockWithAccounting = await db.raw(`select p1, p5, hyspt.fdate as fromDate, hyspt.tdate as toDate, hyspa.caption as caption from hyspt 
  inner join hyspa on hyspt.keyhyspa = hyspa.keyhyspa
  inner join repsk on hyspa.keyhyspa = repsk.keycode
  inner join babuf ON hyspt.keycmobj = babuf.keycmobj
  inner join cmobj on hyspt.keycmobj = cmobj.keycmobj
  where babuf.hyresid = ?
  and hyspt.fdate < ? 
  and (hyspt.tdate > ? or hyspt.tdate is null)
  and repsk.year = ?`, [rentalId, from, to, year])

  return blockWithAccounting.map(transformRentalBlockWithAccounting)
}