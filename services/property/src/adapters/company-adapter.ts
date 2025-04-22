import { Prisma, PrismaClient } from '@prisma/client'
import { logger } from 'onecore-utilities'

import { trimStrings } from '@src/utils/data-conversion'

const prisma = new PrismaClient({})

export type CompanyBasicInfo = Prisma.CompanyGetPayload<{
  select: typeof companyBasicInfoSelect
}>

const companyBasicInfoSelect = {
  id: true,
  propertyObjectId: true,
  code: true,
  name: true,

  organizationNumber: true,
}

export const getCompanies = async (): Promise<CompanyBasicInfo[] | null> => {
  return prisma.company
    .findMany({
      select: companyBasicInfoSelect,
    })
    .then(trimStrings)
}

export type CompanyDetails = Prisma.CompanyGetPayload<{
  select: typeof companyDetailsSelect
}>

const companyDetailsSelect: Prisma.CompanySelect = {
  id: true,
  propertyObjectId: true,
  code: true,
  name: true,
  organizationNumber: true,
  phone: true,
  fax: true,
  internalExternal: true,
  fTax: true,
  cooperativeHousingAssociation: true,
  differentiatedAdditionalCapital: true,
  rentAdministered: true,
  blocked: true,
  rentDaysPerMonth: true,
  economicPlanApproved: true,
  vatObligationPercent: true,
  vatRegistered: true,
  energyOptimization: true,
  ownedCompany: true,
  interestInvoice: true,
  errorReportAdministration: true,
  mediaBilling: true,
  ownResponsibilityForInternalMaintenance: true,
  subletPercentage: true,
  subletFeeAmount: true,
  disableQuantitiesBelowCompany: true,

  timestamp: true,
}

export const getCompany = async (
  id: string
): Promise<CompanyDetails | null> => {
  try {
    const row = await prisma.company.findUnique({
      where: { id },
      select: companyDetailsSelect,
    })

    if (!row) return null
    return trimStrings(row)
  } catch (err) {
    logger.error({ err }, 'company-adapter.getCompany')
    throw err
  }
}
