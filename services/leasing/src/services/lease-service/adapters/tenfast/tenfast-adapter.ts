import { logger } from '@onecore/utilities'
import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastTenant,
  TenfastRentalObject,
  TenfastRentalObjectByRentalObjectCodeResponseSchema,
  TenfastLeaseTemplate,
  TenfastLeaseTemplateSchema,
  TenfastTenantSchema,
} from '../../../../common/adapters/tenfast/schemas'
import config from '../../../../common/config'
import { AdapterResult } from '../../adapters/types'
import { Contact } from '@onecore/types'
import * as tenfastApi from './tenfast-api'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

export const createLease = async (
  contact: Contact,
  rentalObjectCode: string,
  fromDate: Date,
  listingCategory: 'PARKING_SPACE' | 'APARTMENT' | 'STORAGE',
  includeVAT: boolean
): Promise<
  AdapterResult<
    any,
    | 'could-not-find-template'
    | 'could-not-retrieve-tenant'
    | 'could-not-create-tenant'
    | 'could-not-find-rental-object'
    | 'lease-could-not-be-created'
    | 'create-lease-bad-request'
    | 'unknown'
  >
> => {
  const templateResponse = await getLeaseTemplate(listingCategory)
  if (!templateResponse.ok || !templateResponse.data)
    return { ok: false, err: 'could-not-find-template' }

  const tenantResult = await getOrCreateTenant(contact)
  if (!tenantResult.ok) return { ok: false, err: tenantResult.err }
  else if (!tenantResult.data)
    return { ok: false, err: 'could-not-retrieve-tenant' }

  const rentalObjectResponse = await getRentalObject(rentalObjectCode)
  if (!rentalObjectResponse.ok || !rentalObjectResponse.data)
    return { ok: false, err: 'could-not-find-rental-object' }

  try {
    const createLeaseRequestData = buildLeaseRequestData(
      tenantResult.data,
      rentalObjectResponse.data,
      templateResponse.data,
      fromDate,
      includeVAT
    )

    const leaseResponse = await tenfastApi.request({
      method: 'post',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal?hyresvard=${tenfastCompanyId}`,
      data: createLeaseRequestData,
    })
    if (leaseResponse.status === 400)
      return handleTenfastError(
        leaseResponse.data.error,
        'create-lease-bad-request'
      )
    else if (leaseResponse.status !== 200 && leaseResponse.status !== 201)
      return handleTenfastError(
        { error: leaseResponse.data.error, status: leaseResponse.status },
        'lease-could-not-be-created'
      )

    //TODO: create schema for response and convert to onecore lease type here later
    return { ok: true, data: undefined }
  } catch (err) {
    return handleTenfastError(err, 'lease-could-not-be-created')
  }
}

export const getRentalObject = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<
    TenfastRentalObject | null,
    | 'could-not-find-rental-object'
    | 'could-not-parse-rental-object'
    | 'get-lease-bad-request'
  >
> => {
  try {
    const rentalObjectResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresobjekt?filter[externalId]=${rentalObjectCode}`,
    })

    if (rentalObjectResponse.status === 400)
      return handleTenfastError(
        rentalObjectResponse.data.error,
        'get-lease-bad-request'
      )
    else if (
      rentalObjectResponse.status !== 200 &&
      rentalObjectResponse.status !== 201
    )
      return handleTenfastError(
        {
          error: rentalObjectResponse.data.error,
          status: rentalObjectResponse.status,
        },
        'could-not-find-rental-object'
      )

    const parsedRentalObjectResponse =
      TenfastRentalObjectByRentalObjectCodeResponseSchema.safeParse(
        rentalObjectResponse.data
      )
    if (!parsedRentalObjectResponse.success)
      return handleTenfastError(
        parsedRentalObjectResponse.error,
        'could-not-parse-rental-object'
      )
    return {
      ok: true,
      data: parsedRentalObjectResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    return handleTenfastError(err, 'could-not-find-rental-object')
  }
}

//TODO: Choose a different template depending on bilplatstyp alt poängfri eller ej?
export const getLeaseTemplate = async (
  listingCategory: 'PARKING_SPACE' | 'APARTMENT' | 'STORAGE'
): Promise<
  AdapterResult<
    TenfastLeaseTemplate | undefined,
    | 'could-not-find-template-for-category'
    | 'could-not-get-template'
    | 'get-template-bad-request'
    | 'response-could-not-be-parsed'
    | 'unknown'
  >
> => {
  let templateId

  switch (listingCategory) {
    case 'PARKING_SPACE':
      templateId = config.tenfast.leaseTemplates.parkingSpace
      break
    default:
      return handleTenfastError(
        listingCategory,
        'could-not-find-template-for-category'
      )
  }

  try {
    const templateResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtalsmallar/${templateId}`,
    })

    if (templateResponse.status === 400)
      return handleTenfastError(
        templateResponse.data.error,
        'get-template-bad-request'
      )
    else if (templateResponse.status !== 200)
      return handleTenfastError(
        {
          error: templateResponse.data.error,
          status: templateResponse.status,
        },
        'could-not-get-template'
      )

    const parsedTemplateResponse = TenfastLeaseTemplateSchema.safeParse(
      templateResponse.data
    )
    if (!parsedTemplateResponse.success)
      return handleTenfastError(
        parsedTemplateResponse.error,
        'response-could-not-be-parsed'
      )
    return { ok: true, data: parsedTemplateResponse.data ?? undefined }
  } catch (err: any) {
    return handleTenfastError(err, 'unknown')
  }
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<
  AdapterResult<
    TenfastTenant,
    | 'could-not-retrieve-tenant'
    | 'could-not-parse-tenant-response'
    | 'get-tenant-bad-request'
    | 'unknown'
  >
> => {
  try {
    const tenantResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster?filter[externalId]=${contactCode}`,
    })

    // console.log('Tenant response status:', tenantResponse.status)

    if (tenantResponse.status === 400)
      return handleTenfastError(
        tenantResponse.data.error,
        'get-tenant-bad-request'
      )
    else if (tenantResponse.status !== 200 && tenantResponse.status !== 201)
      return handleTenfastError(
        {
          error: tenantResponse.data.error,
          status: tenantResponse.status,
        },
        'could-not-retrieve-tenant'
      )

    const parsedTenantResponse =
      TenfastTenantByContactCodeResponseSchema.safeParse(tenantResponse.data)
    if (!parsedTenantResponse.success)
      return handleTenfastError(
        parsedTenantResponse.error,
        'could-not-parse-tenant-response'
      )

    return {
      ok: true,
      data: parsedTenantResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    return handleTenfastError(err, 'unknown')
  }
}

export const createTenant = async (
  contact: Contact
): Promise<
  AdapterResult<
    TenfastTenant | undefined,
    | 'tenant-could-not-be-created'
    | 'tenant-could-not-be-parsed'
    | 'create-tenant-bad-request'
  >
> => {
  const createTenantRequestData = buildTenantRequestData(contact)

  const tenantResponse = await tenfastApi.request({
    method: 'post',
    url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster?hyresvard=${tenfastCompanyId}`,
    data: createTenantRequestData,
  })

  if (tenantResponse.status === 400)
    return handleTenfastError(
      tenantResponse.data.error,
      'create-tenant-bad-request'
    )
  else if (tenantResponse.status !== 200 && tenantResponse.status !== 201)
    return handleTenfastError(
      {
        error: tenantResponse.data.error,
        status: tenantResponse.status,
      },
      'tenant-could-not-be-created'
    )

  const parsedTenantResponse = TenfastTenantSchema.safeParse(
    tenantResponse.data
  )
  if (!parsedTenantResponse.success)
    return handleTenfastError(
      parsedTenantResponse.error,
      'tenant-could-not-be-parsed'
    )

  return { ok: true, data: parsedTenantResponse.data ?? undefined }
}

async function getOrCreateTenant(
  contact: Contact
): Promise<
  AdapterResult<
    TenfastTenant,
    'could-not-retrieve-tenant' | 'could-not-create-tenant'
  >
> {
  const tenantResponse = await getTenantByContactCode(contact.contactCode)
  if (!tenantResponse.ok) {
    return { ok: false, err: 'could-not-retrieve-tenant' }
  }
  if (!tenantResponse.data) {
    const createTenantResult = await createTenant(contact)
    if (!createTenantResult.ok || !createTenantResult.data) {
      return { ok: false, err: 'could-not-create-tenant' }
    }
    return { ok: true, data: createTenantResult.data }
  }
  return { ok: true, data: tenantResponse.data }
}

function handleTenfastError<E extends string>(errorObj: any, errorLiteral: E) {
  logger.error({ err: JSON.stringify(errorObj) }, errorLiteral)
  return { ok: false, err: errorLiteral } as const
}

function buildLeaseRequestData(
  tenant: TenfastTenant,
  rentalObject: TenfastRentalObject,
  template: TenfastLeaseTemplate,
  fromDate: Date,
  includeVAT: boolean
) {
  let vat = 0
  if (includeVAT) {
    vat = 0.25
  }

  return {
    hyresgaster: [tenant?._id],
    hyresobjekt: [rentalObject._id],
    avtalsbyggare: true,
    hyror: [
      {
        article: rentalObject.article, //TODO: Add Article property once tenfast added it to staging env
        amount: rentalObject.hyra,
        vat: vat,
        label: 'Hyra p-plats', //TODO: denna ska komma från rentalObject.label på samma vis som article gör alternativt från hyror:[]
      },
      ...rentalObject.hyror,
    ],
    startDate: fromDate.toISOString(),
    aviseringsTyp: 'none',
    uppsagningstid: '3m',
    aviseringsFrekvens: '1m',
    forskottAvisering: '2v', //specifies how far in advance the rent invoice should be created
    betalningsOffset: '1d', //specifies the due date for the rent in relation to the start date of the rental period
    betalasForskott: true, //specifies whether the rent should be paid in advance or arrears
    vatEnabled: includeVAT,
    originalTemplate: template._id,
    template: template,
    method: 'bankid',
  }
}

function buildTenantRequestData(contact: Contact) {
  return {
    externalId: contact.contactCode,
    idbeteckning: contact.nationalRegistrationNumber, // orgNr for companies when that is implemented
    // company: contact.company, //doesn't exist on contact yet
    // firmatecknare: contact.firmatecknare, //doesn't exist on contact yet
    isCompany: false,
    name: {
      first: contact.firstName ?? '',
      last: contact.lastName ?? '',
    },
    email: contact.emailAddress,
    phone: contact.phoneNumbers?.find((p) => p.isMainNumber)?.phoneNumber,
    postadress: `${contact.address?.street} ${contact.address?.number}`,
    postnummer: contact.address?.postalCode,
    stad: contact.address?.city,
  }
}
