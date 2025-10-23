import knex from 'knex'
import config from '../../../common/config'
import { InvoiceDataRow } from '../../../common/types'

type FacilityDistributions = Record<
  string,
  { propertyCode: string; costCode: string; distributionPercentage: number }
>

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

export const closeDb = () => {
  db.destroy()
}

const getDistributions = async (
  facilityId: string,
  year: string
): Promise<FacilityDistributions> => {
  // NOTE! This is a very non-standard way of sanitizing input parameters. It is used
  // here because knex has a bug where the query times out if facilityId is passed
  // as a parameter.
  if (!/^\d+$/.test(facilityId)) {
    throw new Error('Wrong format for facility id')
  }

  const query = db('cmval')
    .select('value', 'p3', 'p2')
    .innerJoin('cmvat', 'cmval.keycmvat', 'cmvat.keycmvat')
    .innerJoin('cmvap', 'cmvap.keycmvat', 'cmvat.keycmvat')
    .innerJoin('babyg', 'keycode', 'babyg.keycmobj')
    .innerJoin('babuf', 'keyobjbyg', 'babyg.keycmobj')
    .innerJoin('bafst', 'keyobjfst', 'bafst.keycmobj')
    .innerJoin('drfor', 'drfor.keycmobj', 'babyg.keycmobj')
    .innerJoin('drmhf', 'drfor.keydrmhf', 'drmhf.keydrmhf')
    .innerJoin('drmpt', 'drmpt.keydrmpt', 'drmhf.keydrmpt')
    .innerJoin('repsk', 'repsk.keycode', 'babyg.keybabyg')
    .where('keycmtyp', 'babyg')
    .where('cmval.keycmvat', 'AREATEMP')
    .whereRaw(`mptanlid = '${facilityId}'`)
    .whereNull('keyobjrum')
    .whereNull('keyobjbdl')
    .whereNull('keyobjvan')
    .whereNull('keyobjsys')
    .where('repsk.keydbtbl', 'babyg')
    .where('repsk.year', year)
    .where('repsk.keyrektk', 'INKOP')

  const areaTemps = await query

  const distributions: FacilityDistributions = {}

  const areaTempTotal = areaTemps.reduce((sum, tempRow) => {
    return sum + tempRow.value
  }, 0)

  areaTemps.forEach((areaTemp) => {
    const property = areaTemp.p3.trimEnd()
    if (property !== '0') {
      if (!distributions[property]) {
        distributions[property] = {
          propertyCode: property,
          costCode: areaTemp.p2.trimEnd(),
          distributionPercentage: 0,
        }
      }

      distributions[property].distributionPercentage +=
        areaTemp.value / areaTempTotal
    }
  })

  // If distributionPercentage is 0, there is no distribution. Set to 1.
  for (const [_propertyId, distribution] of Object.entries(distributions)) {
    if (distribution.distributionPercentage === 0) {
      distribution.distributionPercentage = 1
    }
  }

  return distributions
}

export const enrichProcurementInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[]
): Promise<{
  rows: InvoiceDataRow[]
  missingFacilities: Record<string, string>
}> => {
  const enrichedInvoiceRows: InvoiceDataRow[] = []
  const missingFacilities: Record<string, string> = {}
  let facilityId = invoiceDataRows[0].facilityId as string
  let facilityDistributions: FacilityDistributions = await getDistributions(
    invoiceDataRows[0].facilityId as string,
    (invoiceDataRows[0].invoiceDate as string).substring(0, 4)
  )

  for (const invoiceDataRow of invoiceDataRows) {
    if ((invoiceDataRow.facilityId as string).localeCompare(facilityId)) {
      facilityId = invoiceDataRow.facilityId as string
      facilityDistributions = await getDistributions(
        invoiceDataRow.facilityId as string,
        (invoiceDataRow.invoiceDate as string).substring(0, 4)
      )
    }

    if (
      facilityDistributions &&
      Object.keys(facilityDistributions).length > 0
    ) {
      if (!(invoiceDataRow.account as string).startsWith('2')) {
        Object.keys(facilityDistributions).forEach((propertyId: string) => {
          const distribution = facilityDistributions[propertyId]
          const distributionDataRow: InvoiceDataRow = { ...invoiceDataRow }
          distributionDataRow.propertyCode = distribution.propertyCode
          distributionDataRow.costCode = distribution.costCode
          distributionDataRow.totalAmount =
            (distributionDataRow.totalAmount as number) *
            distribution.distributionPercentage

          distributionDataRow.totalAmount =
            Math.round(
              (distributionDataRow.totalAmount + Number.EPSILON) * 100
            ) / 100

          enrichedInvoiceRows.push(distributionDataRow)
        })
      } else {
        enrichedInvoiceRows.push(invoiceDataRow)
      }
    } else {
      missingFacilities[invoiceDataRow.invoiceNumber as string] =
        invoiceDataRow.facilityId as string
    }
  }

  return { rows: enrichedInvoiceRows, missingFacilities }
}
