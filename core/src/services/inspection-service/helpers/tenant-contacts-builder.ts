import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as schemas from '../schemas'
import { identifyTenantContracts } from './email-sender'

type InspectionLite = {
  id: string
  address: string
  apartmentCode: string | null
  residenceId: string
  leaseId: string
}

/**
 * Builds the tenant-contacts response for an inspection's residence.
 *
 * Source-agnostic: any object exposing the InspectionLite fields (raw
 * XpandInspection or enriched DetailedInspection) satisfies the parameter,
 * so both the xpand and internal route handlers share this code path.
 */
export const buildTenantContactsResponse = async (
  inspection: InspectionLite
): Promise<schemas.TenantContactsResponse> => {
  const leases = await leasingAdapter.getLeasesForPropertyId(
    inspection.residenceId,
    {
      includeContacts: true,
      includeUpcomingLeases: true,
      includeTerminatedLeases: true,
    }
  )

  const { newTenant, tenant } = identifyTenantContracts(
    leases,
    inspection.leaseId
  )

  const response: schemas.TenantContactsResponse = {
    inspection: {
      id: inspection.id,
      address: inspection.address,
      apartmentCode: inspection.apartmentCode,
    },
  }

  if (newTenant?.tenants) {
    response.new_tenant = {
      contacts: newTenant.tenants
        .filter((t) => t.emailAddress && t.leaseContactType !== 'subletTenant')
        .map((t) => ({
          fullName: t.fullName,
          emailAddress: t.emailAddress!,
          contactCode: t.contactCode,
        })),
      contractId: newTenant.leaseId,
    }
  }

  if (tenant?.tenants) {
    response.tenant = {
      contacts: tenant.tenants
        .filter((t) => t.emailAddress && t.leaseContactType !== 'subletTenant')
        .map((t) => ({
          fullName: t.fullName,
          emailAddress: t.emailAddress!,
          contactCode: t.contactCode,
        })),
      contractId: tenant.leaseId,
    }
  }

  return response
}
