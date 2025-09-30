import knex from 'knex'
import config from '../../../common/config'
import {
  InvoiceDataRow,
  Invoice as InvoiceRecord,
  InvoiceDeliveryMethod,
} from '../../../common/types'
import {
  Address,
  Invoice,
  InvoiceTransactionType,
  invoiceTransactionTypeTranslation,
  PaymentStatus,
  paymentStatusTranslation,
} from '@onecore/types'
import { logger } from '@onecore/utilities'
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
    requestTimeout: 15000,
  },
  pool: { min: 0, max: 10 },
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
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

export const getInvoices = async (rows: InvoiceDataRow[]) => {
  const uniqueInvoiceNumbers: Record<string, string> = {}

  rows.forEach((row) => {
    uniqueInvoiceNumbers[row.invoiceNumber as string] = row.tenantName as string
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
    invoice.tenantName =
      uniqueInvoiceNumbers[(invoice.invoice as string).trimEnd()]
    invoiceTypes[invoice.name] = true
  })

  return invoices
}

const _getRentArticleDetails = async (
  year: string,
  includeInternal: boolean
): Promise<RentArticleDetails> => {
  const rentArticleQuery = db('cmart')
    .innerJoin('repsk', 'cmart.keycmart', 'repsk.keycode')
    .innerJoin('repsr', 'repsk.keyrepsr', 'repsr.keyrepsr')
    .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
    .andWhere('keyrektk', 'INTAKT')
    .andWhere('repsk.year', year)
    .andWhere((query) => {
      if (includeInternal) {
        query
          .orWhere('repsr.keycode', 'FADBT_HYRA')
          .orWhere('repsr.keycode', 'FADBT_INTHYRA')
      } else {
        query.where('repsr.keycode', 'FADBT_HYRA')
      }
    })
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
      costCode: row['p2']?.toString().trimEnd(),
      property: row['p3']?.toString().trimEnd(),
    }
  })

  return specificRules
}

const getRentalRowSpecificRule = async (
  row: InvoiceDataRow
): Promise<RentalSpecificRule | null> => {
  const rowSpecificRuleResult = await db('repsk')
    .innerJoin('repsr', 'repsk.keyrepsr', 'repsr.keyrepsr')
    .innerJoin('repst', 'repst.keydbtbl', 'repsk.keydbtbl')
    .innerJoin('hyrad', 'repsk.keycode', 'hyrad.keyhyrad')
    .innerJoin('cmart', 'cmart.keycmart', 'hyrad.keycmart')
    .innerJoin('hyobj', 'hyrad.keyhyobj', 'hyobj.keyhyobj')
    .where('repsk.year', '2025')
    .andWhere('keyrektk', 'INTAKT')
    .andWhere('repst.name', 'Hyresrad')
    .andWhere('hyobj.hyobjben', row.contractCode)
    .andWhere('cmart.code', row.rentArticle)

  if (rowSpecificRuleResult && rowSpecificRuleResult.length > 0) {
    return {
      costCode: rowSpecificRuleResult[0].p2?.toString().trimEnd(),
      property: rowSpecificRuleResult[0].p3?.toString().trimEnd(),
      projectCode: rowSpecificRuleResult[0].p4?.toString().trimEnd(),
      freeCode: rowSpecificRuleResult[0].p5?.toString().trimEnd(),
    }
  } else {
    return null
  }
}

const getAdditionalColumns = async (
  row: InvoiceDataRow,
  /*rentArticleDetails: RentArticleDetails,*/
  rentalSpecificRules: RentalSpecificRules
): Promise<InvoiceDataRow | null> => {
  const rentArticleName = row.rentArticle
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}

  if ('Öresutjämning' == row.invoiceRowText) {
    return {}
  }

  /*  const rentArticle = rentArticleDetails[rentArticleName]

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
  additionalColumns['SumRow'] = rentArticle['sumRowText']?.toString().trimEnd()*/

  let specificRule: RentalSpecificRule | null = null

  if (row.company === '001' && !additionalColumns['costCode'] && contractCode) {
    specificRule = rentalSpecificRules[contractCode.split('/')[0]]
    if (!specificRule) {
      logger.error(
        row,
        'Could not find cost code and property for normal rent row'
      )
      return null
    }
  } else if (row.company === '006') {
    specificRule = await getRentalRowSpecificRule(row)
  }

  if (specificRule) {
    additionalColumns['costCode'] = specificRule['costCode']
    additionalColumns['property'] = specificRule['property']

    if (specificRule['projectCode']) {
      additionalColumns['projectCode'] = specificRule['projectCode']
    }

    if (specificRule['freeCode']) {
      additionalColumns['freeCode'] = specificRule['freeCode']
    }
  }

  return additionalColumns
}

export const enrichInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  invoices: Record<string, InvoiceRecord>
): Promise<{
  rows: InvoiceDataRow[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  let i = 1
  const errors: { invoiceNumber: string; error: string }[] = []

  invoiceDataRows.forEach((row) => {
    /*const invoice = invoices.find((invoice) => {
      return (
        (row.invoiceNumber as string).localeCompare(
          (invoice.invoice as string).trimEnd()
        ) === 0
      )
    })*/
    const invoice = invoices[row.invoiceNumber]

    if (invoice) {
      /*      row.invoiceDate = xledgerDateString(invoice.invdate as Date)
      row.invoiceFromDate = xledgerDateString(invoice.fromdate as Date)
      row.invoiceToDate = xledgerDateString(invoice.todate as Date)
      row.invoiceDueDate = xledgerDateString(invoice.expdate as Date)*/
      row.invoiceDate = invoice.invdate as string
      row.invoiceFromDate = invoice.fromdate as string
      row.invoiceToDate = invoice.todate as string
      row.invoiceDueDate = invoice.expdate as string
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
  /*const rentArticleDetails = await getRentArticleDetails(
    '2025',
    invoiceDataRows[0].company === '006'
  )*/

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow | null> => {
        const additionalColumns = await getAdditionalColumns(
          row,
          /*rentArticleDetails,*/
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

        return { ...row, ...additionalColumns }
      }
    )
  )

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

function transformFromDbInvoice(row: any): Invoice {
  return {
    invoiceId: row.invoiceId.trim(),
    leaseId: row.leaseId?.trim(),
    amount: row.amount,
    fromDate: row.fromDate,
    toDate: row.toDate,
    invoiceDate: row.invoiceDate,
    expirationDate: row.expirationDate,
    debitStatus: row.debitStatus,
    paymentStatus: getPaymentStatus(row.paymentStatus),
    transactionType: getTransactionType(row.transactionType),
    transactionTypeName: row.transactionTypeName.trim(),
    type: 'Regular',
  }
}

export const getInvoicesByContactCode = async (
  contactKey: string
): Promise<Invoice[] | undefined> => {
  logger.info(
    { contactCode: contactKey },
    'Getting invoices by contact code from Xpand DB'
  )

  const rows = await db
    .select(
      'krfkh.invoice as invoiceId',
      'krfkh.reference as leaseId',
      'krfkh.amount as amount',
      'krfkh.fromdate as fromDate',
      'krfkh.todate as toDate',
      'krfkh.invdate as invoiceDate',
      'krfkh.expdate as expirationDate',
      'krfkh.debstatus as debitStatus',
      'krfkh.paystatus as paymentStatus',
      'krfkh.keyrevrt as transactionType',
      'revrt.name as transactionTypeName'
    )
    .from('krfkh')
    .innerJoin('cmctc', 'cmctc.keycmctc', 'krfkh.keycmctc')
    .innerJoin('revrt', 'revrt.keyrevrt', 'krfkh.keyrevrt')
    .where({ 'cmctc.cmctckod': contactKey })
    .orderBy('krfkh.fromdate', 'desc')
  if (rows && rows.length > 0) {
    const invoices: Invoice[] = rows
      .filter((row) => {
        // Only include invoices with invoiceIds
        // that have not been deleted (debitStatus 6 = makulerad)
        if (row.invoiceId && row.debitStatus !== 6) {
          return true
        } else {
          return false
        }
      })
      .map(transformFromDbInvoice)
    logger.info(
      { contactCode: contactKey },
      'Getting invoices by contact code from Xpand DB completed'
    )
    return invoices
  }

  logger.info(
    { contactCode: contactKey },
    'Getting invoices by contact code from Xpand DB completed - no invoices found'
  )
  return undefined
}

export const getRentalInvoices = async (
  fromDate: Date,
  toDate: Date,
  companyId: string
) => {
  const rentalInvoiceNumbers = await db.raw(
    "select DISTINCT(invoice) from krfkr inner join krfkh on krfkr.keykrfkh = krfkh.keykrfkh \
  		inner join cmcmp on krfkh.keycmcmp = cmcmp.keycmcmp \
	    inner join cmart on cmart.code = krfkr.code \
	    inner join cmarg on cmart.keycmarg = cmarg.keycmarg \
      inner Join repsk on cmart.keycmart = repsk.keycode \
      inner join repsr on repsk.keyrepsr = repsr.keyrepsr \
      where (repsr.keycode = 'FADBT_HYRA' OR repsr.keycode = 'FADBT_INTHYRA') \
      and cmcmp.code = ? \
      and krfkh.fromdate >= ? AND krfkh.fromdate < ?",
    [companyId, fromDate, toDate]
  )

  return rentalInvoiceNumbers
}

export const getInvoiceRows = async (
  fromDate: Date,
  endDate: Date,
  companyId: string,
  invoiceNumbers: string[]
) => {
  if (invoiceNumbers.length === 0) {
    return []
  }
  /*invoiceRows = await db('krfkh')
    .innerJoin('krfkr', 'krfkr.keykrfkh', 'krfkh.keykrfkh')
    .innerJoin('cmart', 'cmart.code', 'krfkr.code')
	  .innerJoin('cmarg',' cmart.keycmarg','cmarg.keycmarg')
      .innerJoin('repsk',' cmart.keycmart','repsk.keycode')
      .innerJoin repsr','repsk.keyrepsr',' repsr.keyrepsr
      where (repsr.keycode = 'FADBT_HYRA' OR repsr.keycode = 'FADBT_INTHYRA')
      and keyrektk = 'INTAKT'
      and repsk.year = '2025'
      and krfkh.fromdate >= '2025-10-01' --AND krfkh.todate <= '2025-10-31'*/

  const invoiceRowsQuery = db.raw(
    "select cmart.code as rentArticle, cmart.utskrgrupp as printGroup, krfkr.reduction as rowReduction, \
      krfkr.amount as rowAmount, krfkr.vat as rowVat, cmcmp.code as company, \
      krfkh.fromdate as invoiceFromDate, krfkh.todate as invoiceToDate, * \
      from krfkr inner join krfkh on krfkr.keykrfkh = krfkh.keykrfkh \
      inner join cmctc on krfkh.keycmctc = cmctc.keycmctc \
  		inner join cmcmp on krfkh.keycmcmp = cmcmp.keycmcmp \
    	inner join cmart on cmart.code = krfkr.code \
	    inner join cmarg on cmart.keycmarg = cmarg.keycmarg \
      inner Join repsk on cmart.keycmart = repsk.keycode \
      inner join repsr on repsk.keyrepsr = repsr.keyrepsr \
      where (repsr.keycode = 'FADBT_HYRA' OR repsr.keycode = 'FADBT_INTHYRA') \
      and keyrektk = 'INTAKT' \
      and repsk.year = '2025' \
      and cmcmp.code = ? \
      and invoice in (" +
      invoiceNumbers.map((_) => "'" + _ + "'").join(',') +
      ')',
    [companyId]
  )

  const invoiceRows = await invoiceRowsQuery

  logger.info(
    {
      includedRows: invoiceRows.length,
      includedInvoices: new Set<string>(
        invoiceRows.map((row: any) => row.invoice)
      ).size,
      requestedInvoices: invoiceNumbers.length,
    },
    'Retrieved invoices'
  )

  const sumColumns = (...args: any[]) => {
    let sum = 0

    args.forEach((arg) => {
      sum += arg as number
    })

    return sum
  }

  const trim = (column: any): string => {
    return (column as string).trimEnd()
  }

  const convertedInvoiceRows = invoiceRows.map(
    (invoiceRow: any): InvoiceDataRow => {
      const type = invoiceRow['type'] as number

      const invoice = {
        rentArticle: trim(invoiceRow['rentArticle']),
        invoiceRowText: trim(invoiceRow['text']),
        totalAmount: sumColumns(
          invoiceRow['rowAmount'],
          invoiceRow['rowReduction'],
          invoiceRow['rowVat']
        ),
        amount: sumColumns(invoiceRow['rowAmount']),
        vat: sumColumns(invoiceRow['rowVat']),
        deduction: sumColumns(invoiceRow['rowReduction']),
        company: trim(invoiceRow['company']),
        invoiceDate: xledgerDateString(invoiceRow['invdate'] as Date),
        finalPaymentDate: xledgerDateString(invoiceRow['expdate'] as Date),
        invoiceNumber: trim(invoiceRow['invoice']),
        contactCode: trim(invoiceRow['cmctckod']),
        contractCode: trim(invoiceRow['reference']),
        tenantName: trim(invoiceRow['cmctcben']),
        account: trim(invoiceRow['p1']),
        projectCode: trim(invoiceRow['p4']),
        freeCode: trim(invoiceRow['p5']),
        roundoff: sumColumns(invoiceRow['roundoff']),
        fromDate: xledgerDateString(invoiceRow['invoiceFromDate'] as Date),
        toDate: xledgerDateString(invoiceRow['invoiceToDate'] as Date),
        printGroup: trim(invoiceRow['printGroup']),
      }

      if (type === 2) {
        // credit invoice, reverse signs
        invoice.totalAmount = -invoice.totalAmount
        invoice.amount = -invoice.amount
        invoice.vat = -invoice.vat
        invoice.deduction = -invoice.deduction
        invoice.roundoff = -invoice.roundoff
      }

      return invoice
    }
  )

  return convertedInvoiceRows
}

function getTransactionType(transactionTypeString: any) {
  if (!transactionTypeString || !(typeof transactionTypeString == 'string')) {
    return InvoiceTransactionType.Other
  }

  let transactionType =
    invoiceTransactionTypeTranslation[transactionTypeString.trimEnd()]

  if (!transactionType) {
    transactionType = InvoiceTransactionType.Other
  }

  return transactionType
}

function getPaymentStatus(paymentStatusNumber: number) {
  const paymentStatus = paymentStatusTranslation[paymentStatusNumber]

  return paymentStatus
}
