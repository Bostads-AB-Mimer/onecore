import { leasing } from '@onecore/types'
import { createExcelExport, formatDateForExcel } from '@onecore/utilities'

import {
  LeaseSearchQueryBuilder,
  transformRow,
  parseContactsJson,
  getStatusLabel,
} from './lease-search-adapter'

/**
 * Export leases to Excel (no pagination)
 * Reuses LeaseSearchQueryBuilder with same filters as search
 * Returns Excel buffer for download
 */
export const exportLeasesToExcel = async (
  params: leasing.v1.LeaseSearchQueryParams
): Promise<Buffer> => {
  const builder = new LeaseSearchQueryBuilder(params)

  // Apply all filters (same as searchLeases)
  builder
    .applySearch()
    .applyObjectTypeFilter()
    .applyStatusFilter()
    .applyDateFilters()
    .applyPropertyFilter()
    .applyBuildingFilter()
    .applyAreaFilter()
    .applyDistrictFilter()
    .applyBuildingManagerFilter()
    .buildSelectFields()
    .applySorting()

  // Execute without pagination (get all matching rows)
  const rows = await builder.getQuery()

  // Transform rows
  const leases = rows.map((row: any) => {
    const basicData = transformRow(row)
    const contacts = parseContactsJson(row.contactsJson)
    return { ...basicData, contacts }
  })

  // Define lease type for rowMapper
  type LeaseWithContacts = (typeof leases)[number]

  return createExcelExport({
    sheetName: 'Hyreskontrakt',
    columns: [
      { header: 'Kontraktsnummer', key: 'leaseId', width: 18 },
      { header: 'Hyresgäst', key: 'tenantName', width: 30 },
      { header: 'Kundnummer', key: 'contactCode', width: 18 },
      { header: 'E-post', key: 'email', width: 30 },
      { header: 'Telefon', key: 'phone', width: 15 },
      { header: 'Objekttyp', key: 'objectType', width: 12 },
      { header: 'Kontraktstyp', key: 'leaseType', width: 20 },
      { header: 'Adress', key: 'address', width: 35 },
      { header: 'Fastighet', key: 'property', width: 20 },
      { header: 'Distrikt', key: 'districtName', width: 15 },
      { header: 'Startdatum', key: 'startDate', width: 12 },
      { header: 'Slutdatum', key: 'endDate', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
    ],
    data: leases,
    rowMapper: (lease: LeaseWithContacts) => {
      // Format contacts (join multiple with semicolon)
      const tenantNames = lease.contacts
        .map((c: leasing.v1.ContactInfo) => c.name)
        .join('; ')
      const contactCodes = lease.contacts
        .map((c: leasing.v1.ContactInfo) => c.contactCode)
        .join('; ')
      const emails = lease.contacts
        .filter((c: leasing.v1.ContactInfo) => c.email)
        .map((c: leasing.v1.ContactInfo) => c.email)
        .join('; ')
      const phones = lease.contacts
        .filter((c: leasing.v1.ContactInfo) => c.phone)
        .map((c: leasing.v1.ContactInfo) => c.phone)
        .join('; ')

      return {
        leaseId: lease.leaseId,
        tenantName: tenantNames || '',
        contactCode: contactCodes || '',
        email: emails || '',
        phone: phones || '',
        objectType: lease.objectTypeCode,
        leaseType: lease.leaseType,
        address: lease.address || '',
        property: lease.property || '',
        districtName: lease.districtName || '',
        startDate: formatDateForExcel(lease.startDate),
        endDate: formatDateForExcel(lease.lastDebitDate),
        status: getStatusLabel(lease.status),
      }
    },
  })
}
