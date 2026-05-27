import { logger } from '@onecore/utilities'
import { Prisma } from '@prisma/client'

import type { KvvArea } from '@src/types/kvv-area'

import type { PropertyKvvAreaLink } from '../types/kvv-area'

import { prisma } from './db'

export const findKvvAreaCodesByResponsibles = async (
  userIds: string[]
): Promise<string[]> => {
  if (userIds.length === 0) return []
  try {
    const rows = await prisma.onecoreKvvArea.findMany({
      where: { responsibleKeycloakUserId: { in: userIds } },
      select: { code: true },
    })
    return rows.map((r) => r.code)
  } catch (err) {
    logger.error({ err }, 'kvv-area-adapter.findKvvAreaCodesByResponsibles')
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
  | { ok: true; data: KvvArea }
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
