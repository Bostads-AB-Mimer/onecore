import {
  TenfastInvoiceRow,
  TenfastLease,
  TenfastTenant,
  YearMonthDayString,
} from '../adapters/tenfast/schemas'
import { leasing, schemas } from '@onecore/types'
import {
  findInsuredTenant,
  homeInsuranceLfStatus,
  selectCurrentHomeInsuranceRow,
  toHomeInsuranceListItem,
} from './home-insurance'

type LfExportRow = schemas.v1.HomeInsuranceExportRow

// A lease the Länsförsäkringar file holds, with what its row is built from.
type LfSelection = {
  lease: TenfastLease
  tenant: TenfastTenant & { idbeteckning: string }
  rentalObject: TenfastLease['hyresobjekt'][number]
  insuranceRow: TenfastInvoiceRow & { from: YearMonthDayString }
}

/**
 * The leases the Länsförsäkringar file holds: those with a private tenant
 * with a personal identity number, a rental object, and a current home
 * insurance row with a first day and an amount that is not negative. Both
 * the file and the staff list (rows=lf) select through this, so they agree.
 */
const selectLfRows = (
  leases: TenfastLease[],
  articleId: string,
  today?: string
): LfSelection[] =>
  leases
    .filter((lease) => lease.hyresgaster.some((t) => !t.isCompany))
    .flatMap((lease) => {
      const tenant = findInsuredTenant(lease)
      if (!tenant) return []

      const rentalObject = lease.hyresobjekt[0]
      if (!rentalObject) return []

      // The row in force, else the next to start, else the last ended (see
      // selectCurrentHomeInsuranceRow), not just the first row of the article.
      const insuranceRow = selectCurrentHomeInsuranceRow(
        lease.hyror,
        articleId,
        today
      )
      if (!insuranceRow) return []
      const from = insuranceRow.from
      if (!from) return []
      if (insuranceRow.amount < 0) return []

      return [
        {
          lease,
          tenant,
          rentalObject,
          insuranceRow: { ...insuranceRow, from },
        },
      ]
    })

export const mapLeasesToLfExportRows = (
  leases: TenfastLease[],
  articleId: string
): LfExportRow[] =>
  selectLfRows(leases, articleId).map(
    ({ lease, tenant, rentalObject, insuranceRow }) => ({
      leaseId: lease.externalId,
      leaseStatus: homeInsuranceLfStatus(insuranceRow, lease),
      leaseFromDate: lease.startDate,
      leaseToDate: lease.endDate ?? null,
      rentalObjectCode: rentalObject.externalId,
      numberOfRooms: rentalObject.roomCount ?? null,
      squareMeters:
        rentalObject.kvm != null ? Math.round(rentalObject.kvm) : null,
      rowFromDate: new Date(insuranceRow.from),
      rowToDate: insuranceRow.to ? new Date(insuranceRow.to) : null,
      annualRent: insuranceRow.amount,
      articleText: insuranceRow.label ?? '',
      nationalIdNumber: tenant.idbeteckning,
      fullName: `${tenant.name.last} ${tenant.name.first}`,
      address: rentalObject.postadress ?? '',
      postalCode: rentalObject.postnummer ?? '',
      city: rentalObject.stad ?? '',
      phoneNumber: tenant.phone,
      email: tenant.invoiceEmail ?? null,
    })
  )

/**
 * The rows of the Länsförsäkringar file as staff list items: the same
 * selection, without the person data the file carries.
 */
export const mapLeasesToLfListItems = (
  leases: TenfastLease[],
  articleId: string,
  today?: string
): leasing.HomeInsuranceListItem[] =>
  selectLfRows(leases, articleId, today).map(
    ({ lease, tenant, insuranceRow }) =>
      toHomeInsuranceListItem(lease, insuranceRow, tenant)
  )
