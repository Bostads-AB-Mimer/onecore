import { logger } from '@onecore/utilities'
import { Prisma, type OnecoreKvvArea } from '@prisma/client'

import { trimStrings } from '@src/utils/data-conversion'
import type {
  KvvAreaWithCostCenter,
  PropertyKvvAreaLink,
  PropertyKvvAreaLookup,
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

/**
 * Object-level lookup for split properties: the object's building may carry a
 * KVV-area exception (onecore_kvv_area_exception) overriding its property's
 * link — resolution is building exception first, property default second.
 *
 * Like the property lookup above, deliberately NOT filtered by
 * OPERATING_COMPANY_CODES: errands on sold stock must still resolve.
 */
export const getKvvAreaByRentalId = async (
  rentalId: string
): Promise<PropertyKvvAreaLookup | null> => {
  const id = rentalId.trim()
  try {
    // babuf holds one row per structure element and rooms inherit their
    // parent's hyresid; the cmobj type filter picks the object row itself.
    const rows = await prisma.$queryRaw<
      { propertyCode: string | null; buildingCode: string | null }[]
    >`
      SELECT TOP 1
        LTRIM(RTRIM(b.fstcode)) AS propertyCode,
        LTRIM(RTRIM(b.bygcode)) AS buildingCode
      FROM dbo.babuf b
      INNER JOIN dbo.cmobj o ON o.keycmobj = b.keycmobj
      WHERE b.deletemark = 0
        AND b.hyresid = ${id}
        AND o.keycmobt IN ('balgh', 'babps', 'balok', 'bahyr')
    `

    const row = rows[0]
    if (!row?.propertyCode) return null

    if (row.buildingCode) {
      const exception = await prisma.onecoreKvvAreaException
        .findUnique({
          where: {
            objectType_code: { objectType: 'building', code: row.buildingCode },
          },
          include: { kvvArea: { include: { costCenter: true } } },
        })
        .then(trimStrings)

      if (exception) {
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
    }

    return getKvvAreaByPropertyCode(row.propertyCode)
  } catch (err) {
    logger.error({ err, rentalId }, 'kvv-area-adapter.getKvvAreaByRentalId')
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
  | { ok: true; data: OnecoreKvvArea }
  | { ok: false; err: 'not-found' }

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
