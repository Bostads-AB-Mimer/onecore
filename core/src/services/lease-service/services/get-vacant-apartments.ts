import {
  ListingStatus,
  RentalObjectAvailabilityInfo,
  leasing,
  property,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import { AdapterResult } from '../../../adapters/types'

type Block = property.RentalBlock

// A listing at these stages means the apartment is already being let:
// published now, or publishing is over and it sits in visning/erbjudande.
const LETTING_IN_PROGRESS = [ListingStatus.Active, ListingStatus.Expired]

// Tenure types (Xpand hyresobjektstyp, mirrored as Tenfast category) that never
// go through this queue: övernattning, Västerås Stad's stock and student flats.
export const EXCLUDED_TENURE_TYPES = new Set(['NATT', 'BLOCK', 'AVS', 'STUD'])

/**
 * The block that governs availability: an open-ended one wins, otherwise
 * the one ending last. Mirrors the ROW_NUMBER pick in leasing's Xpand query.
 */
export const pickGoverningBlock = (blocks: Block[]): Block | null => {
  if (blocks.length === 0) return null
  return blocks.reduce((best, b) => {
    if (best.toDate === null) return best
    if (b.toDate === null) return b
    return b.toDate > best.toDate ? b : best
  })
}

const startOfUtcDay = (d: Date) => {
  const copy = new Date(d)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

/** Free the day after the block ends, or Tenfast's date if later. The block's
 * start is irrelevant: a block ahead means no letting before it either. */
export const vacantFromAfterBlock = (
  vacantFrom: Date | string | undefined,
  block: Block | null
): Date => {
  const fromTenfast = vacantFrom
    ? startOfUtcDay(new Date(vacantFrom))
    : startOfUtcDay(new Date())
  if (!block?.toDate) return fromTenfast
  const dayAfterBlock = startOfUtcDay(block.toDate)
  dayAfterBlock.setUTCDate(dayAfterBlock.getUTCDate() + 1)
  return fromTenfast > dayAfterBlock ? fromTenfast : dayAfterBlock
}

export type VacantApartmentSources = {
  availability: RentalObjectAvailabilityInfo
  residence: property.ResidenceBatchItem
  blocks: Block[]
  summary: leasing.RentalObjectListingSummary
}

/** Pure merge of the sources into one row; null when the row is out. */
export const toVacantApartment = ({
  availability,
  residence,
  blocks,
  summary,
}: VacantApartmentSources): leasing.VacantApartment | null => {
  if (EXCLUDED_TENURE_TYPES.has(availability.rentalTenureType?.id)) return null
  // No rent configured means it is not let through this process (e.g. SÄLEN).
  if (!availability.rent.amount) return null

  const listing = summary.currentListing
  if (listing && LETTING_IN_PROGRESS.includes(listing.status)) return null

  // An open-ended block, started or not, has no date to let from.
  const block = pickGoverningBlock(blocks)
  if (block && block.toDate === null) return null

  return {
    rentalObjectCode: availability.rentalObjectCode,
    address: residence.address,
    apartmentNumber: residence.apartmentNumber,
    propertyCode: residence.property?.code ?? null,
    propertyName: residence.property?.name ?? null,
    buildingCode: residence.building?.code ?? null,
    marketAreaCode: residence.marketArea?.code ?? null,
    marketAreaName: residence.marketArea?.name ?? null,
    residenceTypeName: residence.residenceType?.name ?? null,
    roomCount: residence.residenceType?.roomCount ?? null,
    floor: residence.floor,
    elevator: residence.elevator,
    area: residence.area,
    rent: availability.rent.amount,
    rentalTenureType: availability.rentalTenureType ?? null,
    rentalTags: availability.rentalTags ?? [],
    vacantFrom: vacantFromAfterBlock(availability.vacantFrom, block),
    block: block
      ? {
          fromDate: block.fromDate,
          toDate: block.toDate,
          reason: block.blockReason,
        }
      : null,
    listing,
    closedListingsSinceLastLease: summary.closedListingsSinceLastLease,
  }
}

export type GetVacantApartmentsError =
  | 'get-availabilities-failed'
  | 'get-residences-failed'
  | 'get-rental-blocks-failed'
  | 'get-listing-summaries-failed'

/** Apartments for the "Publicera" step; see toVacantApartment for the rules.
 * Codes Tenfast knows but property does not are logged and dropped. */
export const getVacantApartments = async (): Promise<
  AdapterResult<leasing.VacantApartment[], GetVacantApartmentsError>
> => {
  const availabilities =
    await leasingAdapter.getVacantRentalObjectAvailabilities('apartment')
  if (!availabilities.ok) {
    return { ok: false, err: 'get-availabilities-failed' }
  }
  if (availabilities.data.length === 0) return { ok: true, data: [] }

  const codes = availabilities.data.map((a) => a.rentalObjectCode)
  const [residences, blocks, summaries] = await Promise.all([
    propertyBaseAdapter.getResidencesBatch(codes),
    propertyBaseAdapter.getRentalBlocksBatch(codes),
    leasingAdapter.getListingSummariesByRentalObjectCodes({
      rentalObjects: availabilities.data.map((a) => ({
        rentalObjectCode: a.rentalObjectCode,
        listingHistorySince: a.listingHistorySince ?? null,
      })),
      listingCategory: 'APARTMENT',
    }),
  ])
  if (!residences.ok) return { ok: false, err: 'get-residences-failed' }
  if (!blocks.ok) return { ok: false, err: 'get-rental-blocks-failed' }
  if (!summaries.ok) return { ok: false, err: 'get-listing-summaries-failed' }

  const residenceByCode = new Map(residences.data.map((r) => [r.rentalId, r]))
  const summaryByCode = new Map(
    summaries.data.map((s) => [s.rentalObjectCode, s])
  )
  const blocksByCode = new Map<string, Block[]>()
  for (const block of blocks.data) {
    const list = blocksByCode.get(block.rentalId) ?? []
    list.push(block)
    blocksByCode.set(block.rentalId, list)
  }

  const rows: leasing.VacantApartment[] = []
  const unknown: string[] = []
  for (const availability of availabilities.data) {
    const code = availability.rentalObjectCode
    const residence = residenceByCode.get(code)
    const summary = summaryByCode.get(code)
    if (!residence || !summary) {
      unknown.push(code)
      continue
    }
    const row = toVacantApartment({
      availability,
      residence,
      blocks: blocksByCode.get(code) ?? [],
      summary,
    })
    if (row) rows.push(row)
  }

  if (unknown.length > 0) {
    logger.warn(
      { count: unknown.length, sample: unknown.slice(0, 10) },
      'Vacant apartments in Tenfast without property or listing data were skipped'
    )
  }

  rows.sort((a, b) => a.rentalObjectCode.localeCompare(b.rentalObjectCode))
  return { ok: true, data: rows }
}
