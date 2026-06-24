import axios from 'axios'
import config from '../../config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../../types'
import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastInvoicesByTenantIdResponseSchema,
  TenfastTenant,
  TenfastInvoicesByOcrResponseSchema,
  TenfastInvoicesByExportedResponseSchema,
  TenfastInvoice,
  TenfastInvoiceRow,
  TenfastRentArticleSchema,
  TenfastRentArticle,
  TenfastRentalLossHyraSchema,
  TenfastRentalLossSchema,
  TenfastRentalLoss,
  TenfastRentalLossResponseSchema,
} from './schemas'
import {
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  PaymentStatus,
} from '@onecore/types'
import {
  InvoiceRowWithAccounting,
  InvoiceWithAccounting,
  MimerCompany,
  RentalLoss,
  RentalLossRow,
  TenfastRentalObject,
} from '@src/common/types/typesv2'

const invoiceStates = [
  'betald',
  'ny',
  'ej-avprickad',
  'forsenad',
  'delvis-betald',
  'krediterad',
  'anstand',
]

const baseUrl = config.tenfast.baseUrl
const apiKey = config.tenfast.apiKey

const makeTenfastRequest = async (
  url: string,
  config?: {
    method?: string
    params?: Record<string, string | string[] | number | number[] | undefined>
    data?: any
  }
) => {
  return axios.request({
    baseURL: baseUrl,
    url,
    method: config?.method ?? 'GET',
    data: config?.data,
    params: config?.params,
    headers: {
      'Content-type': 'application/json',
      'api-token': apiKey,
    },
  })
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await makeTenfastRequest(
      '/v1/hyresvard/hyresgaster',
      {
        params: {
          'filter[externalId]': contactCode,
        },
      }
    )
    if (tenantResponse.status !== 200) {
      return { ok: false, err: tenantResponse.statusText }
    }

    const parsedResponse = TenfastTenantByContactCodeResponseSchema.safeParse(
      tenantResponse.data
    )
    if (!parsedResponse.success) {
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: parsedResponse.data ?? null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const getTenantById = async (
  id: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await makeTenfastRequest(
      `/v1/hyresvard/hyresgaster/${id}`
    )
    if (tenantResponse.status !== 200) {
      return { ok: false, err: tenantResponse.statusText }
    }

    const parsedResponse = TenfastTenantByContactCodeResponseSchema.safeParse(
      tenantResponse.data
    )
    if (!parsedResponse.success) {
      console.error(parsedResponse.error)
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: parsedResponse.data ?? null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const getRentalObjectById = async (
  id: string
): Promise<AdapterResult<TenfastRentalObject, string>> => {
  try {
    const result = await makeTenfastRequest(`/v1/hyresvard/hyresobjekt/${id}`)
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const rentalObject: TenfastRentalObject = {
      _id: result.data._id,
      externalId: result.data.externalId,
    }

    return { ok: true, data: rentalObject }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoicesForTenant = async (
  tenantId: string
): Promise<AdapterResult<Invoice[], string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/hyresgaster/${tenantId}/hyror`
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByTenantIdResponseSchema.safeParse(
      result.data
    )

    if (!parsedResponse.success) {
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsedResponse.data.map(transformToInvoice) }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<Invoice | null, string>> => {
  try {
    const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        'filter[ocrNumber]': ocr,
        states: invoiceStates.join(','),
      },
    })
    if (result.status !== 200) {
      logger.error(
        { error: result.statusText },
        'Error getting invoices from Tenfast'
      )
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByOcrResponseSchema.safeParse(
      result.data
    )

    if (!parsedResponse.success) {
      logger.error(
        { error: parsedResponse.error },
        'Error parsing Tenfast invoice'
      )
      return { ok: false, err: 'schema-error' }
    }

    const invoice = parsedResponse.data.records[0]
      ? transformToInvoice(parsedResponse.data.records[0])
      : null

    if (invoice && parsedResponse.data.records?.[0].recipientId) {
      const tenantResult = await getTenantById(
        parsedResponse.data.records[0].recipientId
      )
    }

    return {
      ok: true,
      data: invoice,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoiceArticle = async (
  articleId: string
): Promise<AdapterResult<TenfastRentArticle, string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/articles/${articleId}`
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastRentArticleSchema.safeParse(result.data)
    if (!parsedResponse.success) {
      logger.error(parsedResponse)
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsedResponse.data }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const transformToInvoice = (tenfastInvoice: TenfastInvoice): Invoice => {
  const remainingAmount = tenfastInvoice.amount - tenfastInvoice.amountPaid

  return {
    amount: tenfastInvoice.amount,
    debitStatus: 0, //
    fromDate: new Date(tenfastInvoice.interval.from),
    toDate: new Date(tenfastInvoice.interval.to),
    invoiceDate: tenfastInvoice.activatedAt
      ? new Date(tenfastInvoice.activatedAt)
      : new Date(tenfastInvoice.expectedInvoiceDate), // If tenfastInvoice.state == 'draft', activatedAt will be null
    expirationDate: new Date(tenfastInvoice.due),
    paidAmount: tenfastInvoice.amountPaid,
    remainingAmount,
    roundoff: tenfastInvoice.roundingAmount,
    invoiceId: tenfastInvoice.ocrNumber,
    externalId: tenfastInvoice._id,
    leaseId: tenfastInvoice.contractCode!!,
    recipientContactCode: tenfastInvoice.recipientContactCode!!,
    recipientName: tenfastInvoice.recipientName!!,
    paymentStatus:
      remainingAmount <= 0 ? PaymentStatus.Paid : PaymentStatus.Unpaid,
    type: 'Regular',
    reference: tenfastInvoice.ocrNumber,
    source: 'next', // ??
    invoiceRows: tenfastInvoice.hyror.map(transformToInvoiceRow),
    transactionType: InvoiceTransactionType.Rent,
    // TODO this is only (?) used for uniquely identifying invoices with the same invoice number in mina sidor.
    // We should maybe add a unique id property to the Invoice type instead
    transactionTypeName: 'some random string',
    credit: null,
  }
}

const transformToInvoiceRow = (
  tenfastInvoiceRow: TenfastInvoiceRow
): InvoiceRow => {
  return {
    amount: tenfastInvoiceRow.amount,
    rentArticle: tenfastInvoiceRow.article,
    fromDate: tenfastInvoiceRow.from ?? '',
    toDate: tenfastInvoiceRow.to ?? '',
    vat: tenfastInvoiceRow.vat,
    totalAmount: tenfastInvoiceRow.amount * (1 + (tenfastInvoiceRow.vat ?? 0)),
    printGroup: tenfastInvoiceRow.consolidationLabel ?? null,
    invoiceRowText: null, // Set later from related article
    rentalObject: tenfastInvoiceRow.hyresobjekt,
    // We do not have the fields below in tenfast at the moment
    deduction: 0,
    roundoff: 0,
    rowType: 0, // TODO We will hopefully not need this anymore when we are using Tenfast for invoice rows
    // TODO Are the fields below needed? Are they something that belong in an invoice row?
    invoiceDate: '',
    invoiceDueDate: '',
    invoiceNumber: '',
  }
}

export const convertToDate = (tenfastDate: string) => {
  return new Date(tenfastDate)
}

const replaceRentalObjectExternalIds = async (invoice: Invoice) => {
  for (const invoiceRow of invoice.invoiceRows) {
    if (invoiceRow.rentalObject) {
      const rentalObjectResult = await getRentalObjectById(
        invoiceRow.rentalObject
      )
      if (rentalObjectResult.ok) {
        invoiceRow.rentalObject = rentalObjectResult.data.externalId
      }
    }
  }
}

const enrichInvoiceRowsWithAccounting = async (
  invoice: Invoice
): Promise<{
  invoiceRows: InvoiceRowWithAccounting[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  const invoiceRowsWithAccounting: InvoiceRowWithAccounting[] = []
  const errors: { invoiceNumber: string; error: string }[] = []

  for (const invoiceRow of invoice.invoiceRows) {
    const invoiceRowWithAccounting: InvoiceRowWithAccounting = {
      ...invoiceRow,
    }

    if (!invoiceRow.rentalObject) {
      logger.error(
        { invoiceId: invoice.invoiceId },
        'Minst en hyresrad på avin saknar hyresobjekt'
      )
      errors.push({
        invoiceNumber: invoice.invoiceId,
        error: `Minst en hyresrad på avin saknar hyresobjekt`,
      })
      continue
    }

    if (invoiceRow.rentArticle) {
      const articleResult = await getInvoiceArticle(invoiceRow.rentArticle)

      if (articleResult.ok) {
        const article = articleResult.data
        invoiceRowWithAccounting.rentArticleName = article.code ?? undefined
        if (article.accountConfigurations?.length) {
          const accountConfiguration = article.accountConfigurations.find(
            (accountConfiguration) => {
              return (
                accountConfiguration.categoryCode === 'Intäkter' &&
                accountConfiguration.debitType === 'HYRA'
              )
            }
          )

          if (accountConfiguration) {
            invoiceRowWithAccounting.account =
              accountConfiguration.accountNr.toString()
            invoiceRowWithAccounting.costCode =
              accountConfiguration.costCenter &&
                accountConfiguration.costCenter !== ''
                ? accountConfiguration.costCenter
                : undefined
            invoiceRowWithAccounting.property =
              accountConfiguration.property &&
                accountConfiguration.property !== ''
                ? accountConfiguration.property
                : undefined
            invoiceRowWithAccounting.projectCode =
              accountConfiguration.projectCode &&
                accountConfiguration.projectCode !== ''
                ? accountConfiguration.projectCode
                : undefined

            invoiceRowWithAccounting.freeCode = accountConfiguration.freeText
          } else {
            logger.error(
              { article },
              'Rent article has no account configuration for Intäkter'
            )
            errors.push({
              invoiceNumber: invoice.invoiceId,
              error: `Hyresartikeln ${article.code} har inget konto för kategorin Intäkter`,
            })
            continue
          }
        } else {
          logger.error(
            { article },
            'Rent article has no account configurations'
          )
          errors.push({
            invoiceNumber: invoice.invoiceId,
            error: `Hyresartikeln ${article.code} har inga konton`,
          })
          continue
        }
      }
    }

    invoiceRowsWithAccounting.push(invoiceRowWithAccounting)
  }
  return {
    invoiceRows: invoiceRowsWithAccounting,
    errors,
  }
}

export const getInvoicesNotExported = async (
  maxCount: number,
  company: MimerCompany
): Promise<
  AdapterResult<
    {
      invoices: InvoiceWithAccounting[]
      errors: { invoiceNumber: string; error: string }[] | undefined
    },
    string
  >
> => {
  const errors: { invoiceNumber: string; error: string }[] = []

  try {
    const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        isManuallyExported: 'false',
        status: 'issued',
        limit: maxCount,
        hyresvard: company.tenfastId,
        /*paginate:
          'eyJpZCI6IjY5ZDZmNDQ0MGM4NGU2YzRjMDRmNGU5MyIsImlzTmV4dCI6dHJ1ZX0',*/
        //ocrNumber: '552606000000733',
      },
    })

    if (result.status !== 200) {
      logger.error(
        { error: result.statusText },
        'Error getting invoices from Tenfast'
      )
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByExportedResponseSchema.safeParse(
      result.data
    )

    if (!parsedResponse.success) {
      logger.error(
        { error: parsedResponse.error },
        'Error parsing Tenfast invoices'
      )
      return { ok: false, err: 'schema-error' }
    }

    const invoices: InvoiceWithAccounting[] = []
    for (const invoiceResult of parsedResponse.data.records) {
      const invoice = transformToInvoice(invoiceResult)

      if (!invoice.invoiceId) {
        console.error(`Invoice ${invoice.externalId} has no ocrNumber`)
      }

      await replaceRentalObjectExternalIds(invoice)

      const invoiceRowsWithAccountingResult =
        await enrichInvoiceRowsWithAccounting(invoice)

      if (invoiceRowsWithAccountingResult.errors?.length === 0) {
        const invoiceWithAccounting = {
          ...invoice,
          invoiceRows: invoiceRowsWithAccountingResult.invoiceRows,
        }

        invoices.push(invoiceWithAccounting)
      } else {
        errors.push(...invoiceRowsWithAccountingResult.errors)
      }
    }

    return {
      ok: true,
      data: {
        invoices,
        errors,
      },
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const emptyToUndefined = (
  value: string | null | undefined
): string | undefined => (value && value !== '' ? value : undefined)

export const mapToRentalLoss = async (
  tenfastRentalLoss: TenfastRentalLoss
): Promise<{
  rentalLoss: RentalLoss
  errors: { invoiceNumber: string; error: string }[]
}> => {
  const errors: { invoiceNumber: string; error: string }[] = []
  const rentalLossRows: RentalLossRow[] = []
  const rentalObjectExternalId = tenfastRentalLoss.hyresobjekt.externalId

  for (const hyra of tenfastRentalLoss.hyresobjekt.hyror) {
    if (!hyra.article) {
      logger.error(
        { rentalObject: rentalObjectExternalId, label: hyra.label },
        'Rental loss row is missing rent article'
      )
      errors.push({
        invoiceNumber: rentalObjectExternalId,
        error: `Hyresraden ${hyra.label} saknar hyresartikel`,
      })
      continue
    }

    const articleResult = await getInvoiceArticle(hyra.article)
    if (!articleResult.ok) {
      errors.push({
        invoiceNumber: rentalObjectExternalId,
        error: `Kunde inte hämta hyresartikel ${hyra.article}`,
      })
      continue
    }

    const article = articleResult.data
    const rentalLossConfigurations =
      article.accountConfigurations?.filter(
        (accountConfiguration) =>
          accountConfiguration.debitType === 'HYRESBORTFALL'
      ) ?? []

    // Only include rows whose article actually has rental loss
    // (HYRESBORTFALL) account configurations.
    if (rentalLossConfigurations.length === 0) {
      continue
    }

    const incomeConfiguration = rentalLossConfigurations.find(
      (accountConfiguration) =>
        accountConfiguration.categoryCode === 'Intäkter'
    )
    const costConfiguration = rentalLossConfigurations.find(
      (accountConfiguration) =>
        accountConfiguration.categoryCode === 'Kostnad/Inköp'
    )

    if (!incomeConfiguration || !costConfiguration) {
      logger.error(
        { article },
        'Rent article is missing rental loss account configuration'
      )
      errors.push({
        invoiceNumber: rentalObjectExternalId,
        error: `Hyresartikeln ${article.code} saknar konton för hyresbortfall (Intäkter och/eller Kostnad/Inköp)`,
      })
      continue
    }

    const uncontractedAmount =
      (hyra.amount * tenfastRentalLoss.days.uncontracted) /
      tenfastRentalLoss.days.month

    rentalLossRows.push({
      amount: Math.round((uncontractedAmount + Number.EPSILON) * 100) / 100,
      totalAmount: Math.round((uncontractedAmount * (1 + (hyra.vat ?? 0)) + Number.EPSILON) * 100) / 100,
      vat: hyra.vat,
      rentArticleName: article.code,
      rentalObject: rentalObjectExternalId,
      incomeAccount: incomeConfiguration.accountNr,
      incomeProjectCode: emptyToUndefined(incomeConfiguration.projectCode),
      incomeProperty: emptyToUndefined(incomeConfiguration.property),
      incomeFreeCode: emptyToUndefined(incomeConfiguration.freeText),
      incomeCostCode: emptyToUndefined(incomeConfiguration.costCenter),
      costAccount: costConfiguration.accountNr,
      costProjectCode: emptyToUndefined(costConfiguration.projectCode),
      costProperty: emptyToUndefined(costConfiguration.property),
      costFreeCode: emptyToUndefined(costConfiguration.freeText),
      costCostCode: emptyToUndefined(costConfiguration.costCenter),
    })
  }

  const rentalLoss: RentalLoss = {
    rentalLossRows,
    rentalObject: rentalObjectExternalId,
    month: tenfastRentalLoss.month,
    days: {
      totalInMonth: tenfastRentalLoss.days.month,
      contracted: tenfastRentalLoss.days.contracted,
      uncontracted: tenfastRentalLoss.days.uncontracted,
    },
    uncontractedIntervals: tenfastRentalLoss.uncontractedIntervals.map(
      (interval) => ({
        from: new Date(interval.from),
        to: new Date(interval.to),
      })
    ),
  }

  return { rentalLoss, errors }
}

export const getRentalLosses = async (
  company: MimerCompany
): Promise<
  AdapterResult<
    {
      rentalLosses: RentalLoss[]
      errors: { invoiceNumber: string; error: string }[] | undefined
    },
    string
  >
> => {
  console.log('Parsing rental loss')

  /*const parsedResponse = TenfastRentalLossResponseSchema.safeParse(JSON.parse(
    `[{
  "month": "2026-05",
  "hyresvard": {
    "id": "6344b398b63ff59d5bde8257",
    "name": "Bostadsaktiebolaget Mimer"
  },
  "hyresobjekt": {
    "id": "6a01b4e104ff913fb088a24b",
    "externalId": "110-004-01-0701",
    "fastighetId": "6a01b4e104ff913fb08899bb",
    "postadress": "Fyrbåksvägen 3",
    "postnummer": "722 10",
    "stad": "VÄSTERÅS",
    "skvNummer": "1601",
    "objektnummer": "0701",
    "typ": "Bostad",
    "hyror": [
      {
        "_id": "6a01cb1fdd5a3ddda8c6d3a5",
        "label": "Hyra bostad",
        "amount": 15,
        "vat": 0,
        "hyresobjekt": "6a01b4e104ff913fb088a24b",
        "article": "67eb8aea545c8f1195bea0ae",
        "includeInContract": true,
        "from": "2025-01-01",
        "to": null,
        "consolidationLabel": "Hyra bostad"
      },
      {
        "_id": "6a01cb22dd5a3ddda8c6fc8a",
        "label": "Mimers Hemförsäkring",
        "amount": 80,
        "vat": 0,
        "hyresobjekt": "6a01b4e104ff913fb088a24b",
        "article": "67eb8aea545c8f1195bea0af",
        "includeInContract": false,
        "from": "2026-01-01",
        "to": null,
        "consolidationLabel": null
      },
      {
        "_id": "6a01cb24dd5a3ddda8c70e6b",
        "label": "Hyra bostad",
        "amount": 58.45,
        "vat": 0,
        "hyresobjekt": "6a01b4e104ff913fb088a24b",
        "article": "67eb8aea545c8f1195bea0b5",
        "includeInContract": true,
        "from": "2026-01-01",
        "to": null,
        "consolidationLabel": "Hyra bostad"
      },
      {
        "_id": "6a01cb24dd5a3ddda8c70fe1",
        "label": "Hyra bostad",
        "amount": 12198.86,
        "vat": 0,
        "hyresobjekt": "6a01b4e104ff913fb088a24b",
        "article": "69f9c53cd96d16781940304c",
        "includeInContract": true,
        "from": "2026-01-01",
        "to": null,
        "consolidationLabel": "Hyra bostad"
      }
    ]
  },
  "days": {
    "month": 31,
    "contracted": 21,
    "uncontracted": 10
  },
  "uncontractedIntervals": [
    {
      "from": "2026-05-01",
      "to": "2026-05-10"
    }
  ],
  "avtalIds": [
    "6a01b51304ff913fb089f593"
  ],
  "relatedAvtalCoverage": [
    {
      "avtalId": "6a01b51304ff913fb089f593",
      "source": "current",
      "reference": 3015,
      "externalId": "110-004-01-0701/04",
      "version": 1,
      "hyresobjekt": [
        "6a01b4e104ff913fb088a24b"
      ],
      "startDate": "2026-05-11T00:00:00.000Z",
      "endDate": null,
      "signed": true,
      "signedAt": "2026-04-10T00:00:00.000Z",
      "cancellation": {
        "cancelled": false,
        "doneAutomatically": false
      },
      "automaticExtension": null
    }
  ]
  }]`
  ))*/

  const reportId = '6a3276034ce55cc308bb2beb'
  const result = await makeTenfastRequest(`/v1/hyresvard/reports/${reportId}/download`, {
    params: {
      hyresvard: company.tenfastId,
      /*paginate:
        'eyJpZCI6IjY5ZDZmNDQ0MGM4NGU2YzRjMDRmNGU5MyIsImlzTmV4dCI6dHJ1ZX0',*/
      //ocrNumber: '552606000000733',
    },
  })

  if (result.status !== 200) {
    logger.error(
      { error: result.statusText },
      'Error getting invoices from Tenfast'
    )
    return { ok: false, err: result.statusText }
  }

  const parsedResponse = TenfastRentalLossResponseSchema.safeParse(result.data)

  if (parsedResponse.error) {
    console.log(parsedResponse.error)
    return { ok: false, err: 'schema-error' }
  }

  const rentalLosses: RentalLoss[] = []
  const errors: { invoiceNumber: string; error: string }[] = []

  const rentalLossResults = parsedResponse.data.filter(rentalLoss => {
    return rentalLoss.days.uncontracted > 0
  })

  for (const tenfastRentalLoss of rentalLossResults) {
    const { rentalLoss, errors: rentalLossErrors } =
      await mapToRentalLoss(tenfastRentalLoss)
    rentalLosses.push(rentalLoss)
    errors.push(...rentalLossErrors)
  }

  return {
    ok: true,
    data: {
      rentalLosses,
      errors: errors.length ? errors : undefined,
    },
  }
}

export const markInvoicesAsExported = async (invoices: Invoice[]) => {
  for (const invoice of invoices) {
    if (invoice.externalId) {
      const result = await makeTenfastRequest(
        `/v1/hyresvard/hyror/${invoice.externalId}/manual-export`,
        { method: 'POST' }
      )
    } else {
      logger.error(
        { invoiceId: invoice.invoiceId },
        'Invoice has no external id'
      )
    }
  }
}
