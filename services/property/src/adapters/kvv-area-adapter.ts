import { logger } from '@onecore/utilities'
import { Prisma, type OnecoreKvvArea } from '@prisma/client'

import { trimStrings } from '@src/utils/data-conversion'
import type { KvvAreaExceptionRow } from '@src/utils/property-shares'
import type {
  KvvAreaWithCostCenter,
  PropertyKvvAreaLink,
  PropertyKvvAreaLookup,
  ResolveKvvAreaQuery,
} from '../types/kvv-area'

import { prisma } from './db'

// Reverse lookup property → kvv-area → cost center. Reads the OneCore-owned
// link table (not Xpand babuf.fencode), so UI-made moves are reflected.
//
// Deliberately NOT filtered by OPERATING_COMPANY_CODES: an errand on a property
// sold into company 999 must still resolve to a district rather than 404.
// Today GET /cost-centers/:id/tree has no company filter either, so the two
// agree. PR #698 adds one to the tree — when that lands, such a property drops
// out of the tree (and out of Odoo's tree-driven backfill) while still
// resolving here. That divergence is the intended outcome; do not "align" this
// lookup with the tree's filter without deciding what happens to those errands.
//
// The code is trimmed: Xpand pads Char columns, and callers (Odoo) forward
// codes straight from Xpand-sourced fields.
export const getKvvAreaByPropertyCode = async (
  propertyCode: string
): Promise<PropertyKvvAreaLookup | null> => {
  try {
    const link = await prisma.onecorePropertyKvvArea
      .findUnique({
        where: { propertyCode: propertyCode.trim() },
        include: { kvvArea: { include: { costCenter: true } } },
      })
      .then(trimStrings)

    if (!link) return null

    return {
      kvvArea: {
        id: link.kvvArea.id,
        code: link.kvvArea.code,
        name: link.kvvArea.name ?? null,
      },
      costCenter: {
        id: link.kvvArea.costCenter.id,
        code: link.kvvArea.costCenter.code,
        name: link.kvvArea.costCenter.name,
      },
      responsibleKeycloakUserId: link.kvvArea.responsibleKeycloakUserId ?? null,
    }
  } catch (err) {
    logger.error(
      { err, propertyCode },
      'kvv-area-adapter.getKvvAreaByPropertyCode'
    )
    throw err
  }
}

const getKvvAreaByBuildingException = async (
  buildingCode: string
): Promise<PropertyKvvAreaLookup | null> => {
  const exception = await prisma.onecoreKvvAreaException
    .findUnique({
      where: {
        objectType_code: { objectType: 'building', code: buildingCode },
      },
      include: { kvvArea: { include: { costCenter: true } } },
    })
    .then(trimStrings)

  if (!exception) return null

  return {
    kvvArea: {
      id: exception.kvvArea.id,
      code: exception.kvvArea.code,
      name: exception.kvvArea.name ?? null,
    },
    costCenter: {
      id: exception.kvvArea.costCenter.id,
      code: exception.kvvArea.costCenter.code,
      name: exception.kvvArea.costCenter.name,
    },
    responsibleKeycloakUserId:
      exception.kvvArea.responsibleKeycloakUserId ?? null,
  }
}

type Location = { propertyCode: string; buildingCode: string | null }

// babuf holds one row per structure element and rooms inherit their parent's
// hyresid; the cmobj type filter picks the object row itself.
const getLocationByRentalId = async (
  rentalId: string
): Promise<Location | null> => {
  const rows = await prisma.$queryRaw<
    { propertyCode: string | null; buildingCode: string | null }[]
  >`
    SELECT TOP 1
      LTRIM(RTRIM(b.fstcode)) AS propertyCode,
      LTRIM(RTRIM(b.bygcode)) AS buildingCode
    FROM dbo.babuf b
    INNER JOIN dbo.cmobj o ON o.keycmobj = b.keycmobj
    WHERE b.deletemark = 0
      AND b.hyresid = ${rentalId}
      AND o.keycmobt IN ('balgh', 'babps', 'balok', 'bahyr')
  `
  const row = rows[0]
  if (!row?.propertyCode) return null
  return { propertyCode: row.propertyCode, buildingCode: row.buildingCode }
}

const getLocationByBuildingCode = async (
  buildingCode: string
): Promise<Location | null> => {
  const rows = await prisma.$queryRaw<{ propertyCode: string | null }[]>`
    SELECT TOP 1 LTRIM(RTRIM(b.fstcode)) AS propertyCode
    FROM dbo.babuf b
    WHERE b.deletemark = 0
      AND b.bygcode = ${buildingCode}
      AND b.fstcode IS NOT NULL
  `
  const row = rows[0]
  if (!row?.propertyCode) return null
  return { propertyCode: row.propertyCode, buildingCode }
}

// A rental id or building code is resolved to its property via Xpand; a
// property code (markyta objects, property-level errands) needs no lookup.
const toLocation = async (
  query: ResolveKvvAreaQuery
): Promise<Location | null> => {
  if ('rentalId' in query) return getLocationByRentalId(query.rentalId.trim())
  if ('buildingCode' in query) {
    return getLocationByBuildingCode(query.buildingCode.trim())
  }
  return { propertyCode: query.propertyCode.trim(), buildingCode: null }
}

/**
 * Location-level lookup for split properties: a building may carry a KVV-area
 * exception (onecore_kvv_area_exception) overriding its property's link —
 * resolution is building exception first, property default second.
 * Callers send exactly one key, the most specific they have.
 *
 * Like the property lookup above, deliberately NOT filtered by
 * OPERATING_COMPANY_CODES: errands on sold stock must still resolve.
 */
export const resolveKvvArea = async (
  query: ResolveKvvAreaQuery
): Promise<PropertyKvvAreaLookup | null> => {
  try {
    const location = await toLocation(query)
    if (!location) return null

    if (location.buildingCode) {
      const exception = await getKvvAreaByBuildingException(
        location.buildingCode
      )
      if (exception) return exception
    }

    return getKvvAreaByPropertyCode(location.propertyCode)
  } catch (err) {
    logger.error({ err, query }, 'kvv-area-adapter.resolveKvvArea')
    throw err
  }
}

/** All split-property exception rows — a handful by design, so no filter.
 * Building rows only: later objectTypes must not mangle membership unseen. */
export const getKvvAreaExceptions = async (): Promise<
  KvvAreaExceptionRow[]
> => {
  try {
    const rows = await prisma.onecoreKvvAreaException
      .findMany({
        where: { objectType: 'building' },
        select: { kvvAreaId: true, propertyCode: true, code: true },
      })
      .then(trimStrings)
    return rows
  } catch (err) {
    logger.error({ err }, 'kvv-area-adapter.getKvvAreaExceptions')
    throw err
  }
}

export type ListKvvAreasFilter = {
  // When given, only areas whose responsible kvartersvärd is one of these
  // Keycloak user ids are returned. Omit to list every area.
  responsibleUserIds?: string[]
}

export const listKvvAreas = async (
  filter: ListKvvAreasFilter = {}
): Promise<KvvAreaWithCostCenter[]> => {
  try {
    const rows = await prisma.onecoreKvvArea
      .findMany({
        ...(filter.responsibleUserIds
          ? {
              where: {
                responsibleKeycloakUserId: { in: filter.responsibleUserIds },
              },
            }
          : {}),
        include: { costCenter: true },
        orderBy: { code: 'asc' },
      })
      .then(trimStrings)

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name ?? null,
      costCenter: {
        id: row.costCenter.id,
        code: row.costCenter.code,
        name: row.costCenter.name,
      },
      responsibleKeycloakUserId: row.responsibleKeycloakUserId ?? null,
    }))
  } catch (err) {
    logger.error({ err, filter }, 'kvv-area-adapter.listKvvAreas')
    throw err
  }
}

export type UpsertPropertyKvvAreaInput = {
  propertyCode: string
  kvvAreaId: string
  updatedBy?: string | null
}

export type UpsertPropertyKvvAreaResult =
  | { ok: true; data: PropertyKvvAreaLink }
  | { ok: false; err: 'kvv-area-not-found' | 'property-not-found' | 'unknown' }

export const upsertPropertyKvvArea = async (
  input: UpsertPropertyKvvAreaInput
): Promise<UpsertPropertyKvvAreaResult> => {
  const { propertyCode, kvvAreaId, updatedBy } = input

  try {
    const [kvvArea, property] = await Promise.all([
      prisma.onecoreKvvArea.findUnique({
        where: { id: kvvAreaId },
        select: { id: true },
      }),
      prisma.property.findUnique({
        where: { code: propertyCode },
        select: { code: true },
      }),
    ])

    if (!kvvArea) return { ok: false, err: 'kvv-area-not-found' }
    if (!property) return { ok: false, err: 'property-not-found' }

    const link = await prisma.onecorePropertyKvvArea.upsert({
      where: { propertyCode },
      create: {
        propertyCode,
        kvvAreaId,
        updatedBy: updatedBy ?? null,
      },
      update: {
        kvvAreaId,
        updatedBy: updatedBy ?? null,
      },
    })

    return {
      ok: true,
      data: {
        propertyCode: link.propertyCode,
        kvvAreaId: link.kvvAreaId,
        updatedAt: link.updatedAt.toISOString(),
        updatedBy: link.updatedBy ?? null,
      },
    }
  } catch (err) {
    logger.error({ err, input }, 'kvv-area-adapter.upsertPropertyKvvArea')
    return { ok: false, err: 'unknown' }
  }
}

export type UpdateKvvAreaResponsibleResult =
  { ok: true; data: OnecoreKvvArea } | { ok: false; err: 'not-found' }

export const updateKvvAreaResponsible = async (
  id: string,
  data: { responsibleKeycloakUserId: string; updatedBy: string }
): Promise<UpdateKvvAreaResponsibleResult> => {
  try {
    const updated = await prisma.onecoreKvvArea.update({
      where: { id },
      data: {
        responsibleKeycloakUserId: data.responsibleKeycloakUserId,
        updatedBy: data.updatedBy,
      },
    })
    return { ok: true, data: updated }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, err: 'not-found' }
    }
    logger.error({ err, id }, 'kvv-area-adapter.updateKvvAreaResponsible')
    throw err
  }
}
