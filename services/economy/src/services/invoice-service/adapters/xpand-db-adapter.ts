import knex from 'knex'
import {
  Address,
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  invoiceTransactionTypeTranslation,
  paymentStatusTranslation,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import config from '@src/common/config'
import {
  InvoiceDataRow,
  Invoice as InvoiceRecord,
  InvoiceDeliveryMethod,
  xledgerDateString,
  XpandContact,
} from '@src/common/types/legacyTypes'

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

const getRentalSpecificRules = async (rentalIds: string[], year: string) => {
  const specificRules: RentalSpecificRules = {}
  const specificRulesBuildingsQuery = db('repsk')
    .innerJoin('babyg', 'babyg.keybabyg', 'repsk.keycode')
    .innerJoin('babuf', 'babyg.keycmobj', 'babuf.keyobjbyg')
    .where('year', year)
    .andWhereLike('keyrektk', 'INTAKT%')
    .whereIn('hyresid', rentalIds)
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
    .whereIn('hyresid', rentalIds)
    .distinct()

  const specificRulesAreas = await specificRulesAreasQuery

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
    .select('p1', 'p2', 'p3', 'p4', 'p5', 'hyrad.avitext as text')
    .innerJoin('repsr', 'repsk.keyrepsr', 'repsr.keyrepsr')
    .innerJoin('repst', 'repst.keydbtbl', 'repsk.keydbtbl')
    .innerJoin('hyrad', 'repsk.keycode', 'hyrad.keyhyrad')
    .innerJoin('cmart', 'cmart.keycmart', 'hyrad.keycmart')
    .innerJoin('hyobj', 'hyrad.keyhyobj', 'hyobj.keyhyobj')
    .where('repsk.year', '2025') // TODO: Fix year.
    .andWhere('keyrektk', 'INTAKT')
    //.andWhere('hyrad.keycmuni', 'year')
    .andWhere('repst.name', 'Hyresrad')
    .andWhere('hyobj.hyobjben', row.contractCode)
    .andWhere('cmart.code', row.rentArticle)

  let rowIndex = 0

  if (rowSpecificRuleResult.length > 1) {
    rowIndex = rowSpecificRuleResult.findIndex((resultRow) => {
      return (row.invoiceRowText as string).localeCompare(resultRow['text'])
    })

    if (rowIndex === -1) {
      logger.error(
        {
          rentArticle: row.rentArticle,
          contractCode: row.contractCode,
          invoiceNumber: row.invoiceNumber,
          invoiceRowText: row.invoiceRowText,
          rowSpecificRuleResult,
        },
        'Multiple results row specific accounting for article'
      )

      throw new Error(
        `Accounting for rent article ${row.rentArticle} on invoice ${row.invoiceNumber} could not be determined (multiple accounting rules found)`
      )
    }
  }

  if (rowSpecificRuleResult && rowSpecificRuleResult.length > 0) {
    return {
      costCode: rowSpecificRuleResult[rowIndex].p2?.toString().trimEnd(),
      property: rowSpecificRuleResult[rowIndex].p3?.toString().trimEnd(),
      projectCode: rowSpecificRuleResult[rowIndex].p4?.toString().trimEnd(),
      freeCode: rowSpecificRuleResult[rowIndex].p5?.toString().trimEnd(),
    }
  } else {
    logger.error(
      {
        contractCode: row.contractCode,
        rentArticle: row.rentArticle,
        invoiceRowText: row.invoiceRowText,
      },
      'No specific rule for invoice row'
    )
    return null
  }
}

const getAdditionalColumns = async (
  row: InvoiceDataRow,
  rentalSpecificRules: RentalSpecificRules
): Promise<InvoiceDataRow | null> => {
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}

  if ('Öresutjämning' == row.invoiceRowText) {
    return {}
  }

  let specificRule: RentalSpecificRule | null = null

  if (row.company === '001' && !additionalColumns['costCode'] && contractCode) {
    specificRule = rentalSpecificRules[contractCode.split('/')[0]]
    if (!specificRule) {
      logger.error(
        row,
        'Could not find cost code and property for normal rent row'
      )
      return {}
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
  const errors: { invoiceNumber: string; error: string }[] = []

  invoiceDataRows.forEach((row) => {
    const invoice = invoices[row.invoiceNumber]

    if (invoice) {
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
        error: 'Fakturans fakturaraderna kunde inte hämtas från Xpand',
      })
    }
  })

  const rentalIdMap: Record<string, boolean> = {}

  invoiceDataRows.forEach((row) => {
    rentalIdMap[row.contractCode.toString().split('/')[0]] = true
  })

  const rentalIds = Object.keys(rentalIdMap)
  const rentalSpecificRules = await getRentalSpecificRules(rentalIds, '2025') // TODO: Fix dynamic year

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow | null> => {
        const additionalColumns = await getAdditionalColumns(
          row,
          rentalSpecificRules
        )

        if (!additionalColumns) {
          logger.error(
            { invoiceNumber: row.invoiceNumber },
            'No additional columns'
          )
          errors.push({
            invoiceNumber: row.invoiceNumber as string,
            error:
              'Kunde inte hitta fastighet eller kostnadsställe för fakturan',
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

function transformFromDbInvoice(row: any, contactCode: string): Invoice {
  const amount = [row.amount, row.reduction, row.vat, row.roundoff].reduce(
    (sum, value) => sum + value,
    0
  )

  return {
    reference: contactCode,
    invoiceId: row.invoiceId.trim(),
    leaseId: row.leaseId?.trim(),
    amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    fromDate: row.fromDate,
    toDate: row.toDate,
    invoiceDate: row.invoiceDate,
    expirationDate: row.expirationDate,
    debitStatus: row.debitStatus,
    paymentStatus: getPaymentStatus(row.paymentStatus),
    transactionType: getTransactionType(row.transactionType),
    transactionTypeName: row.transactionTypeName.trim(),
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  }
}

export const getInvoicesByContactCode = async (
  contactKey: string,
  filters?: { from?: Date }
): Promise<Invoice[] | undefined> => {
  logger.info(
    { contactCode: contactKey },
    'Getting invoices by contact code from Xpand DB'
  )

  let query = db
    .select(
      'krfkh.invoice as invoiceId',
      'krfkh.reference as leaseId',
      'krfkh.amount as amount',
      'krfkh.fromdate as fromDate',
      'krfkh.todate as toDate',
      'krfkh.reduction',
      'krfkh.vat',
      'krfkh.roundoff',
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
    .andWhere('krfkh.type', 'in', [1, 2])
    .orderBy('krfkh.fromdate', 'desc')

  if (filters?.from) {
    query = query.andWhere('krfkh.fromdate', '>=', filters.from)
  }

  const rows = await query

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
      .map((row) => transformFromDbInvoice(row, contactKey))
    logger.info(
      { contactCode: contactKey },
      'Getting invoices by contact code from Xpand DB completed'
    )
    return invoices
  }

  return undefined
}

export const getRentalInvoices = async (
  fromDate: Date,
  toDate: Date,
  companyId: string
) => {
  const keycodes =
    companyId === '001' ? ['FADBT_HYRA'] : ['FADBT_INTHYRA', 'FADBT_HYRA']

  logger.info(
    { keycodes, companyId, fromDate, toDate },
    'Getting new invoices for company'
  )

  const rentalInvoiceQuery = db.raw(
    `select DISTINCT(invoice) from krfkh inner join krfkr on krfkr.keykrfkh = krfkh.keykrfkh
inner join cmcmp on krfkh.keycmcmp = cmcmp.keycmcmp
inner join cmart on cmart.code = krfkr.code
inner join cmarg on cmart.keycmarg = cmarg.keycmarg
inner Join repsk on cmart.keycmart = repsk.keycode
inner join repsr on repsk.keyrepsr = repsr.keyrepsr
where repsr.keycode IN (` +
      keycodes.map((_) => "'" + _ + "'").join(',') +
      ')' +
      `and cmcmp.code = ?
and krfkh.fromdate >= ? AND krfkh.fromdate < ?
and not invoice is null
and not invoice like 'IH%'`,
    [companyId, fromDate, toDate]
  )

  const rentalInvoiceNumbers = await rentalInvoiceQuery

  return rentalInvoiceNumbers
}

export const getBatchTotalAmount = async (invoiceNumbers: string[]) => {
  const total = await db.raw(
    'select SUM( \
	case when krfkh.type = 2 then krfkh.amount + krfkh.vat + roundoff + krfkh.reduction \
  when type = 1 then -(krfkh.amount + krfkh.vat + roundoff + krfkh.reduction) end) \
	as invoicesTotal \
	from krfkh \
	where invoice in (' +
      invoiceNumbers.map((_) => "'" + _ + "'").join(',') +
      ')'
  )

  return total[0].invoicesTotal as number
}

export const getInvoiceRows = async (
  year: number,
  companyId: string,
  invoiceNumbers: string[]
): Promise<InvoiceRow[]> => {
  if (invoiceNumbers.length === 0) {
    return []
  }

  const keycodes =
    companyId === '001' ? ['FADBT_HYRA'] : [/*'FADBT_INTHYRA',*/ 'FADBT_HYRA']
  const invoiceRowsQuery = db.raw(
    `
    SELECT
      cmart.code AS rentArticle,
      cmart.utskrgrupp AS printGroup,
      krfkr.printgroup AS printGroupLabel,
      krfkr.reduction AS rowReduction,
      krfkr.amount AS rowAmount,
      krfkr.vat AS rowVat,
      cmcmp.code AS company,
      krfkh.fromdate AS invoiceFromDate,
      krfkh.todate AS invoiceToDate,
      krfkh.expdate AS expirationDate,
      krfkh.amount + krfkh.vat + roundoff + krfkh.reduction AS invoiceTotal,
      *
    FROM krfkh
    INNER JOIN krfkr ON krfkr.keykrfkh = krfkh.keykrfkh
    INNER JOIN cmcmp ON krfkh.keycmcmp = cmcmp.keycmcmp
    INNER JOIN cmctc ON krfkh.keycmctc = cmctc.keycmctc
    LEFT JOIN cmart ON cmart.keycmart = krfkr.keycmart
    LEFT JOIN cmarg ON cmart.keycmarg = cmarg.keycmarg
    LEFT JOIN repsk ON cmart.keycmart = repsk.keycode
    LEFT JOIN repsr ON repsk.keyrepsr = repsr.keyrepsr
    WHERE
      (
        (repsr.keycode IN (${keycodes.map((_) => "'" + _ + "'").join(',')}) AND keyrektk = 'INTAKT' AND repsk.year = ?) OR
        (krfkh.invoice like '5%' and (repsr.keycode is null and keyrektk is null and repsk.year is null)) or
        (krfkh.invoice like '8%' and ((repsr.keycode is null and keyrektk = 'INTAKT' and repsk.year = ?) or (repsr.keycode is null and keyrektk is null and repsk.year is null)))
      )
      AND cmcmp.code = ?
      AND (krfkh.type = 1 OR krfkh.type = 2)
      AND invoice IN (${invoiceNumbers.map((_) => `'${_}'`).join(',')})
    ORDER BY invoice ASC, krfkr.printsort ASC
    `,
    [year, year, companyId]
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

    return Math.round((sum + Number.EPSILON) * 100) / 100
  }

  const trim = (column: any): string => {
    return column ? (column as string).trimEnd() : column
  }

  const convertedInvoiceRows: InvoiceRow[] = invoiceRows.map(
    (invoiceRow: any) => {
      try {
        const type = invoiceRow['type'] as number

        const invoice: InvoiceRow = {
          account: trim(invoiceRow['p1']),
          amount: sumColumns(invoiceRow['rowAmount']),
          company: trim(invoiceRow['company']),
          contactCode: trim(invoiceRow['cmctckod']),
          deduction: sumColumns(invoiceRow['rowReduction']),
          freeCode: trim(invoiceRow['p5']),
          fromDate: xledgerDateString(invoiceRow['invoiceFromDate'] as Date),
          invoiceDate: xledgerDateString(invoiceRow['invdate'] as Date),
          invoiceDueDate: xledgerDateString(
            invoiceRow['expirationDate'] as Date
          ),
          invoiceNumber: trim(invoiceRow['invoice']),
          invoiceRowText: trim(invoiceRow['text']),
          invoiceTotalAmount: sumColumns(invoiceRow['invoiceTotal']),
          printGroup: trim(invoiceRow['printGroup']),
          printGroupLabel: trim(invoiceRow['printGroupLabel']),
          projectCode: trim(invoiceRow['p4']),
          rentArticle: trim(invoiceRow['rentArticle']),
          roundoff: sumColumns(invoiceRow['roundoff']),
          rowType: sumColumns(invoiceRow['rowtype']),
          tenantName: trim(invoiceRow['cmctcben']),
          toDate: xledgerDateString(invoiceRow['invoiceToDate'] as Date),
          totalAmount: sumColumns(
            invoiceRow['rowAmount'],
            invoiceRow['rowReduction'],
            invoiceRow['rowVat']
          ),
          vat: sumColumns(invoiceRow['rowVat']),
        }

        if (type === 2) {
          // credit invoice, reverse signs
          invoice.totalAmount = -invoice.totalAmount
          invoice.amount = -invoice.amount
          invoice.vat = -invoice.vat
          invoice.deduction = -invoice.deduction
          invoice.roundoff = -invoice.roundoff
          invoice.invoiceTotalAmount = -invoice.invoiceTotalAmount
        }

        return invoice
      } catch (err) {
        logger.error(
          { invoiceRow: JSON.stringify(invoiceRow), err },
          'Error converting row'
        )
        throw new Error('Error converting row')
      }
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
