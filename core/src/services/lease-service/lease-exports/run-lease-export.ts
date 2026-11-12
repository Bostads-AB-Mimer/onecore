import axios from 'axios'
import {
  createExcelExport,
  formatDateForExcel,
  joinField,
  logger,
} from '@onecore/utilities'
import type { ExcelColumn } from '@onecore/utilities'
import { leasing, LeaseStatusLabel } from '@onecore/types'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
import { resolveBuildingManagerToKvvAreaCodes } from '../../../adapters/property-base-adapter/lease-query'
import {
  enrichLeaseContacts,
  resolvePersonnummerInQuery,
} from '../../../adapters/contacts-adapter/lease-query'
import { leaseExportStorageKey } from './constants'
import type { LeaseExportJob, LeaseExportRegistry } from './registry'

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const leaseExportColumns: ExcelColumn[] = [
  { header: 'Kontraktsnummer', key: 'leaseId', width: 18 },
  { header: 'Objektnummer', key: 'rentalObjectCode', width: 20 },
  { header: 'Hyresgäst', key: 'tenantName', width: 30 },
  { header: 'Kundnummer', key: 'contactCode', width: 18 },
  { header: 'E-post', key: 'email', width: 30 },
  { header: 'Telefon', key: 'phone', width: 15 },
  { header: 'Objekttyp', key: 'objectType', width: 12 },
  { header: 'Kontraktstyp', key: 'leaseType', width: 20 },
  { header: 'Adress', key: 'address', width: 35 },
  { header: 'Fastighet', key: 'property', width: 20 },
  { header: 'Distrikt', key: 'district', width: 15 },
  { header: 'Startdatum', key: 'startDate', width: 12 },
  { header: 'Slutdatum', key: 'endDate', width: 12 },
  { header: 'Status', key: 'status', width: 15 },
]

export const leaseExportRowMapper = (lease: leasing.v1.LeaseSearchResult) => ({
  leaseId: lease.leaseId,
  rentalObjectCode: lease.rentalObjectCode || '',
  tenantName: joinField(lease.contacts, (c) =>
    c.contactType === 'subletTenant' ? `${c.name} (andrahand)` : c.name
  ),
  contactCode: joinField(lease.contacts, (c) =>
    c.contactType === 'subletTenant'
      ? `${c.contactCode} (andrahand)`
      : c.contactCode
  ),
  email: joinField(lease.contacts, (c) => c.email),
  phone: joinField(lease.contacts, (c) => c.phone),
  objectType: lease.parkingSpaceType || lease.objectTypeCode,
  leaseType: lease.leaseType,
  address: lease.address || '',
  property: lease.property || '',
  district: lease.districtName || '',
  startDate: formatDateForExcel(lease.startDate),
  endDate: formatDateForExcel(lease.lastDebitDate),
  status: LeaseStatusLabel[lease.status] ?? String(lease.status),
})

class ExportFailure extends Error {
  constructor(
    message: string,
    readonly alreadyLogged = false
  ) {
    super(message)
  }
}

export async function runLeaseExport(
  job: LeaseExportJob,
  registry: LeaseExportRegistry
): Promise<void> {
  try {
    registry.setPhase(job.id, 'fetching-leases')
    const resolved = await resolveBuildingManagerToKvvAreaCodes(job.filters)
    if (!resolved.ok) throw new ExportFailure(resolved.reason)

    let leases: leasing.v1.LeaseSearchResult[] = []
    if (!resolved.emptyResult) {
      const exportQuery = await resolvePersonnummerInQuery(resolved.query)
      const result = await leasingAdapter.getLeasesForExport(exportQuery)
      if (!result.ok) throw new ExportFailure(result.err, true)
      leases = result.data
    }

    registry.setPhase(job.id, 'fetching-contacts', leases.length)
    const enriched = await enrichLeaseContacts(leases, 'leases/export')

    registry.setPhase(job.id, 'building-file')
    const buffer = await createExcelExport<leasing.v1.LeaseSearchResult>({
      sheetName: 'Hyreskontrakt',
      columns: leaseExportColumns,
      data: enriched,
      rowMapper: leaseExportRowMapper,
    })

    registry.setPhase(job.id, 'saving-file')
    const storageKey = leaseExportStorageKey(job.userId, job.id, job.startedAt)
    const upload = await fileStorageAdapter.uploadFile(
      storageKey,
      buffer,
      XLSX_CONTENT_TYPE
    )
    if (!upload.ok) throw new ExportFailure(upload.err, true)

    registry.complete(job.id, storageKey)
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 503) {
      registry.fail(job.id, 'lease-service-warming-up')
      return
    }
    if (err instanceof ExportFailure && err.alreadyLogged) {
      registry.fail(job.id, 'export-failed')
      return
    }
    const logged = axios.isAxiosError(err)
      ? { status: err.response?.status, error: err.message }
      : { error: err instanceof Error ? err.message : String(err) }
    logger.error({ err: logged, exportId: job.id }, 'Lease export failed')
    registry.fail(job.id, 'export-failed')
  }
}
