import { TenfastLease } from '../adapters/tenfast/schemas'
import { schemas } from '@onecore/types'

type LfExportRow = schemas.v1.HomeInsuranceExportRow

export const mapLeasesToLfExportRows = (
  leases: TenfastLease[],
  articleId: string
): LfExportRow[] => {
  return leases
    .filter((lease) => lease.hyresgaster.some((t) => !t.isCompany))
    .flatMap((lease) => {
      const tenant = lease.hyresgaster.find(
        (t): t is typeof t & { idbeteckning: string } =>
          !t.isCompany && !!t.idbeteckning
      )
      if (!tenant) return []

      const rentalObject = lease.hyresobjekt[0]
      if (!rentalObject) return []

      const insuranceRow = lease.hyror.find((row) => row.article === articleId)
      if (!insuranceRow) return []
      if (!insuranceRow.from) return []

      const leaseStatus =
        insuranceRow.to != null ? '*' : lease.stage === 'upcoming' ? 'K' : 'G'

      return [
        {
          leaseId: lease.externalId,
          leaseStatus,
          leaseFromDate: lease.startDate,
          leaseToDate: lease.endDate ?? null,
          rentalObjectCode: rentalObject.externalId,
          numberOfRooms: rentalObject.roomCount ?? null,
          squareMeters: rentalObject.kvm ?? null,
          rowFromDate: new Date(insuranceRow.from),
          rowToDate: insuranceRow.to ? new Date(insuranceRow.to) : null,
          annualRent: insuranceRow.amount,
          articleText: insuranceRow.label ?? '',
          nationalIdNumber: tenant.idbeteckning,
          fullName: `${tenant.name.last} ${tenant.name.first}`,
          address: tenant.postadress ?? '',
          phoneNumber: tenant.phone ?? '',
          email: tenant.invoiceEmail ?? null,
        },
      ]
    })
}
