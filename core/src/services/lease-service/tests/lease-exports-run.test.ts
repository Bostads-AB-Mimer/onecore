jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')
  return {
    ...actual,
    // createExcelExport lazy-loads exceljs, which needs
    // --experimental-vm-modules under Jest's CJS transform.
    createExcelExport: jest.fn(),
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }
})

import { leasing, LeaseStatus, LeaseType } from '@onecore/types'
import * as utilities from '@onecore/utilities'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
import { contactsAdapter } from '../../../adapters/contacts-adapter'
import * as factory from '../../../../test/factories'
import {
  createLeaseExportRegistry,
  LeaseExportPhase,
  LeaseExportRegistry,
} from '../lease-exports/registry'
import {
  leaseExportStorageKey,
  LEASE_EXPORT_STORAGE_PREFIX,
} from '../lease-exports/constants'
import { runLeaseExport } from '../lease-exports/run-lease-export'

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const NOW = new Date('2026-03-04T10:00:00.000Z')

const buildLeaseSearchResult = (
  overrides: Partial<leasing.v1.LeaseSearchResult> = {}
): leasing.v1.LeaseSearchResult => ({
  leaseId: '705-001-01-0101/1',
  objectTypeCode: 'Bostad',
  leaseType: LeaseType.HousingContract,
  contacts: [
    { contactCode: 'P158770', name: 'Test Testsson', email: null, phone: null },
  ],
  address: 'Testgatan 1',
  postalCode: '72216',
  city: 'Västerås',
  startDate: new Date('2024-01-01'),
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: LeaseStatus.Current,
  rentalObjectCode: '705-001-01-0101',
  ...overrides,
})

const axios503 = () =>
  Object.assign(new Error('Service Unavailable'), {
    isAxiosError: true,
    response: { status: 503 },
  })

describe('runLeaseExport', () => {
  let registry: LeaseExportRegistry
  let phases: LeaseExportPhase[]
  let leaseCounts: Array<number | undefined>

  const start = (
    filters: Record<string, string | string[] | undefined> = {}
  ) => {
    const claim = registry.claim('user-a', filters)
    if (!claim.ok) throw new Error('claim failed')
    return claim.job
  }
  const jobOf = (id: string) => {
    const job = registry.listForUser('user-a').find((j) => j.id === id)
    if (!job) throw new Error('job missing')
    return job
  }

  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers({ now: NOW })
    registry = createLeaseExportRegistry({
      now: () => new Date(),
      finishedTtlMs: 1000,
    })
    phases = []
    leaseCounts = []
    const original = registry.setPhase
    registry.setPhase = (id, phase, leaseCount) => {
      phases.push(phase)
      leaseCounts.push(leaseCount)
      original(id, phase, leaseCount)
    }
    ;(utilities.createExcelExport as jest.Mock).mockResolvedValue(
      Buffer.from('excel')
    )
    jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: true, data: { fileName: 'x' } } as never)
    jest
      .spyOn(leasingAdapter, 'getLeasesForExport')
      .mockResolvedValue({ ok: true, data: [buildLeaseSearchResult()] })
    jest
      .spyOn(contactsAdapter, 'getByContactCodeBatch')
      .mockResolvedValue({ ok: true, data: [] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('builds the storage key from user, export id and date', () => {
    expect(LEASE_EXPORT_STORAGE_PREFIX).toBe('lease-exports/')
    expect(leaseExportStorageKey('user-a', 'abc', NOW)).toBe(
      'lease-exports/user-a/abc/hyreskontrakt-2026-03-04.xlsx'
    )
  })

  it('reports each phase in order, uploads the xlsx and completes the job', async () => {
    const job = start()

    await runLeaseExport(job, registry)

    expect(phases).toEqual([
      'fetching-leases',
      'fetching-contacts',
      'building-file',
      'saving-file',
    ])
    const key = `lease-exports/user-a/${job.id}/hyreskontrakt-2026-03-04.xlsx`
    expect(fileStorageAdapter.uploadFile).toHaveBeenCalledWith(
      key,
      Buffer.from('excel'),
      XLSX_CONTENT_TYPE
    )
    expect(jobOf(job.id)).toMatchObject({ status: 'done', storageKey: key })
  })

  it('resolves buildingManager to kvvAreaCodes before calling leasing', async () => {
    const lookupSpy = jest
      .spyOn(propertyBaseAdapter, 'listKvvAreas')
      .mockResolvedValue({
        ok: true,
        data: [factory.kvvAreaWithCostCenter.build({ code: 'KVV21' })],
      })

    await runLeaseExport(start({ buildingManager: 'user-1' }), registry)

    expect(lookupSpy).toHaveBeenCalledWith({ responsibleUserIds: ['user-1'] })
    expect(leasingAdapter.getLeasesForExport).toHaveBeenCalledWith(
      expect.objectContaining({ kvvAreaCodes: ['KVV21'] })
    )
    expect(leasingAdapter.getLeasesForExport).toHaveBeenCalledWith(
      expect.not.objectContaining({ buildingManager: expect.anything() })
    )
  })

  it('resolves a personnummer in q to a contact code before calling leasing', async () => {
    jest.spyOn(contactsAdapter, 'getByNationalId').mockResolvedValue({
      ok: true,
      data: factory.contactsServiceContact.build({ contactCode: 'P158770' }),
    })

    await runLeaseExport(start({ q: '198001011234' }), registry)

    expect(leasingAdapter.getLeasesForExport).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'P158770' })
    )
  })

  it('enriches contacts from contacts-service before building the file', async () => {
    jest.spyOn(leasingAdapter, 'getLeasesForExport').mockResolvedValue({
      ok: true,
      data: [
        buildLeaseSearchResult({
          contacts: [
            {
              contactCode: 'P158770',
              name: 'Andra Handen',
              email: 'fran-tenfast@example.com',
              phone: '0701112233',
            },
          ],
        }),
      ],
    })
    jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
      ok: true,
      data: [
        factory.contactsServiceContact.build({
          contactCode: 'P158770',
          communication: {
            emailAddresses: [
              {
                emailAddress: 'fran-contacts-service@example.com',
                isPrimary: true,
                type: 'unspecified',
              },
            ],
            phoneNumbers: [
              {
                phoneNumber: '0709998877',
                isPrimary: true,
                type: 'unspecified',
              },
            ],
            specialAttention: false,
          },
        }),
      ],
    })

    await runLeaseExport(start(), registry)

    const args = (utilities.createExcelExport as jest.Mock).mock.calls[0][0]
    expect(args.data[0].contacts[0].email).toBe(
      'fran-contacts-service@example.com'
    )
    expect(args.data[0].contacts[0].phone).toBe('0709998877')
  })

  it('writes an empty file without calling leasing when buildingManager has no KVV areas', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listKvvAreas')
      .mockResolvedValue({ ok: true, data: [] })
    const job = start({ buildingManager: 'user-1' })

    await runLeaseExport(job, registry)

    expect(leasingAdapter.getLeasesForExport).not.toHaveBeenCalled()
    const args = (utilities.createExcelExport as jest.Mock).mock.calls[0][0]
    expect(args.data).toEqual([])
    expect(fileStorageAdapter.uploadFile).toHaveBeenCalledTimes(1)
    expect(jobOf(job.id)).toMatchObject({ status: 'done', leaseCount: 0 })
  })

  it('fails with lease-service-warming-up on a 503 without logging an error', async () => {
    jest
      .spyOn(leasingAdapter, 'getLeasesForExport')
      .mockRejectedValue(axios503())
    const job = start()

    await runLeaseExport(job, registry)

    expect(jobOf(job.id)).toMatchObject({
      status: 'failed',
      failureReason: 'lease-service-warming-up',
    })
    expect(utilities.logger.error).not.toHaveBeenCalled()
  })

  it('fails with export-failed when leasing returns not ok', async () => {
    jest
      .spyOn(leasingAdapter, 'getLeasesForExport')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    const job = start()

    await runLeaseExport(job, registry)

    expect(jobOf(job.id)).toMatchObject({
      status: 'failed',
      failureReason: 'export-failed',
    })
    expect(utilities.logger.error).not.toHaveBeenCalled()
  })

  it('fails with export-failed when the upload fails', async () => {
    jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    const job = start()

    await runLeaseExport(job, registry)

    expect(jobOf(job.id)).toMatchObject({
      status: 'failed',
      failureReason: 'export-failed',
    })
    expect(utilities.logger.error).not.toHaveBeenCalled()
  })

  it('fails with export-failed when buildingManager cannot be resolved', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listKvvAreas')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    const job = start({ buildingManager: 'user-1' })

    await runLeaseExport(job, registry)

    expect(leasingAdapter.getLeasesForExport).not.toHaveBeenCalled()
    expect(jobOf(job.id)).toMatchObject({
      status: 'failed',
      failureReason: 'export-failed',
    })
  })

  it('sets leaseCount to the number of rows after fetching leases', async () => {
    jest.spyOn(leasingAdapter, 'getLeasesForExport').mockResolvedValue({
      ok: true,
      data: [
        buildLeaseSearchResult({ leaseId: '705-001-01-0101/1' }),
        buildLeaseSearchResult({ leaseId: '705-001-01-0102/1' }),
        buildLeaseSearchResult({ leaseId: '705-001-01-0103/1' }),
      ],
    })
    const job = start()

    await runLeaseExport(job, registry)

    expect(leaseCounts[phases.indexOf('fetching-contacts')]).toBe(3)
    expect(jobOf(job.id).leaseCount).toBe(3)
  })
})
