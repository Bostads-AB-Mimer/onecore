import knex from 'knex'
import config from '../../../common/config'
import {
  InvoiceDataRow,
  Invoice,
  InvoiceDeliveryMethod,
} from '../../../common/types'
import { Address } from 'onecore-types'
import { logger } from 'onecore-utilities'
import { xledgerDateString, XpandContact } from '../../../common/types'

type RentArticleDetails = Record<
  string,
  {
    account: string
    costCode: string
    property: string
    projectCode: string
    freeCode: string
    sumRowText: string
  }
>

type RentalSpecificRules = Record<
  string,
  {
    costCode: string
    property: string
  }
>

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
    requestTimeout: 15000,
  },
  client: 'mssql',
})

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

export const getInvoices = async (rows: InvoiceDataRow[]) => {
  const uniqueInvoiceNumbers: Record<string, boolean> = {}

  rows.forEach((row) => {
    uniqueInvoiceNumbers[row.invoiceNumber as string] = true
  })

  const invoiceNumbers = Object.keys(uniqueInvoiceNumbers)

  const invoices = await db('krfkh')
    .innerJoin('revrt', 'krfkh.keyrevrt', 'revrt.keyrevrt')
    .innerJoin('cmctc', 'krfkh.keycmctc', 'cmctc.keycmctc')
    .whereIn('invoice', invoiceNumbers)
    .where('name', 'HYRA')
    .orWhere('name', 'HYRA INTERN')

  const invoiceTypes: Record<string, boolean> = {}
  invoices.forEach((invoice) => {
    invoiceTypes[invoice.name] = true
  })

  return invoices
}

const getRentArticleDetails = async (
  year: string
): Promise<RentArticleDetails> => {
  const rentArticleQuery = db('cmart')
    .innerJoin('repsk', 'cmart.keycmart', 'repsk.keycode')
    .innerJoin('repsr', 'repsk.keyrepsr', 'repsr.keyrepsr')
    .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
    .andWhere('repsr.keycode', 'FADBT_HYRA')
    .andWhere('keyrektk', 'INTAKT')
    .andWhere('repsk.year', year)
    .andWhere('keycmuni', 'month')
    .distinct()

  const rentArticleResult = await rentArticleQuery
  const rentArticleDetails: RentArticleDetails = {}

  rentArticleResult.forEach((rentArticle) => {
    rentArticleDetails[rentArticle.code.toString().trimEnd()] = {
      account: rentArticle['p1'].toString().trimEnd(),
      costCode: rentArticle['p2'].toString().trimEnd(),
      property: rentArticle['p3'].toString().trimEnd(),
      projectCode: rentArticle['p4'].toString().trimEnd(),
      freeCode: rentArticle['p5'].toString().trimEnd(),
      sumRowText: rentArticle['hysumben']?.toString().trimEnd(),
    }
  })

  return rentArticleDetails
}

const getRentalSpecificRules = async (rentalIds: string[], year: string) => {
  const specificRules: RentalSpecificRules = {}
  const specificRulesBuildings = await db('repsk')
    .innerJoin('babyg', 'babyg.keybabyg', 'repsk.keycode')
    .innerJoin('babuf', 'babyg.keycmobj', 'babuf.keyobjbyg')
    .where('year', year)
    .andWhereLike('keyrektk', 'INTAKT%')
    .whereIn('hyresid', rentalIds)
    .distinct()

  specificRulesBuildings.forEach((row) => {
    specificRules[row['hyresid'].toString().trimEnd()] = {
      costCode: row['p2'].toString().trimEnd(),
      property: row['p3'].toString().trimEnd(),
    }
  })

  const specificRulesAreas = await db('repsk')
    .innerJoin('bayta', 'bayta.keybayta', 'repsk.keycode')
    .innerJoin('babuf', 'bayta.keycmobj', 'babuf.keyobjyta')
    .where('year', year)
    .andWhereLike('keyrektk', 'INTAKT%')
    .whereIn('hyresid', rentalIds)
    .distinct()

  specificRulesAreas.forEach((row) => {
    specificRules[row['hyresid'].toString().trimEnd()] = {
      costCode: row['p2'].toString().trimEnd(),
      property: row['p3'].toString().trimEnd(),
    }
  })

  return specificRules
}

const getAdditionalColumns = async (
  row: InvoiceDataRow,
  rentArticleDetails: RentArticleDetails,
  rentalSpecificRules: RentalSpecificRules
): Promise<InvoiceDataRow | null> => {
  const rentArticleName = row.rentArticle
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}

  if ('Öresutjämning' == row.invoiceRowText) {
    return {}
  }

  const rentArticle = rentArticleDetails[rentArticleName]

  if (!rentArticle) {
    logger.error({ rentArticleName }, 'Rent article details not found')
    throw new Error(`Rent article details for ${rentArticleName} not found`)
  }
  additionalColumns['account'] = rentArticle['account']?.toString().trimEnd()
  additionalColumns['costCode'] = rentArticle['costCode']?.toString().trimEnd()
  additionalColumns['property'] = rentArticle['property']?.toString().trimEnd()
  additionalColumns['projectCode'] = rentArticle['projectCode']
    ?.toString()
    .trimEnd()
  additionalColumns['freeCode'] = rentArticle['freeCode']?.toString().trimEnd()
  additionalColumns['SumRow'] = rentArticle['sumRowText']?.toString().trimEnd()

  if (!additionalColumns['costCode'] && contractCode) {
    const specificRule = rentalSpecificRules[contractCode.split('/')[0]]

    if (specificRule) {
      additionalColumns['costCode'] = specificRule['costCode']
        ?.toString()
        .trimEnd()
      additionalColumns['property'] = specificRule['property']
        ?.toString()
        .trimEnd()
    } else {
      logger.error(row, 'Could not find cost code and property')
      return null
    }
  }
  return additionalColumns
}

export const enrichInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  invoices: Invoice[]
): Promise<{
  rows: InvoiceDataRow[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  let i = 1
  const errors: { invoiceNumber: string; error: string }[] = []

  invoiceDataRows.forEach((row) => {
    const invoice = invoices.find((invoice) => {
      return (
        (row.invoiceNumber as string).localeCompare(
          (invoice.invoice as string).trimEnd()
        ) === 0
      )
    })

    if (invoice) {
      row.invoiceDate = xledgerDateString(invoice.invdate as Date)
      row.invoiceFromDate = xledgerDateString(invoice.fromdate as Date)
      row.invoiceToDate = xledgerDateString(invoice.todate as Date)
      row.invoiceDueDate = xledgerDateString(invoice.expdate as Date)
    } else {
      // Invoice is not found in Xpand. A common reason is that it's an
      // invoice of the wrong type, for instance reminder.
      invoiceDataRows = invoiceDataRows.filter((filterRow) => {
        return !(filterRow.invoiceNumber as string).localeCompare(
          row.invoiceNumber as string
        )
      })
      logger.error(
        row.invoiceNumber,
        'Invoice not found in XPand, removed invoice rows'
      )
      errors.push({
        invoiceNumber: row.invoiceNumber as string,
        error: 'Invoice not found in XPand, removed invoice rows',
      })
    }
  })

  const rentalIdMap: Record<string, boolean> = {}

  invoiceDataRows.forEach((row) => {
    rentalIdMap[row.contractCode.toString().split('/')[0]] = true
  })

  const rentalIds = Object.keys(rentalIdMap)
  const rentalSpecificRules = await getRentalSpecificRules(rentalIds, '2025')
  const rentArticleDetails = await getRentArticleDetails('2025')

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow | null> => {
        const additionalColumns = await getAdditionalColumns(
          row,
          rentArticleDetails,
          rentalSpecificRules
        )

        if (!additionalColumns) {
          logger.error({}, 'No additional columns')
          errors.push({
            invoiceNumber: row.invoiceNumber as string,
            error: 'Could not find costcode and property',
          })
          return null
        }

        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        process.stdout.write('Enriching ' + (i++).toString())

        return { ...row, ...additionalColumns }
      }
    )
  )

  process.stdout.write('\n')

  const rows = (await Promise.all(enrichedInvoiceRows)).filter((row) => row)

  return { rows: rows as InvoiceDataRow[], errors }
}

/*const getContactEmail = async (contactCode: string): Promise<string> => {
  const mailresult = await db('cmeml')
    .select('cmlelben')
    .innerJoin('cmctc', 'cmeml.keycmobj', 'cmctc.keycmobj')
    .where('cmctckod', contactCode)
    .orderBy('main', 'desc')

  if (mailresult) {
    return mailresult[0].cmlelben?.trimEnd()
  } else {
    return ''
  }
}*/

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
      'krknr.autogiro as autogiro'
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
        city: invoiceAddress.address4?.trimEnd(),
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
      autogiro: contactRow.autogiro && contactRow.autogiro !== 0,
      invoiceDeliveryMethod:
        emailAddress !== ''
          ? InvoiceDeliveryMethod.Email
          : InvoiceDeliveryMethod.Other,
    }
  })

  return contacts
}
