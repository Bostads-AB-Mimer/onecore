import { prisma } from './db'

export interface RentalObjectTypeResult {
  code: string
  name: string | null
}

/**
 * Looks up the rental object type for a given rental object code (rentalId).
 *
 * Queries RentalObject (bahyr) joined with RentalObjectType (bahyt)
 * to get the type code and name.
 */
export async function getRentalObjectTypeByRentalId(
  rentalId: string
): Promise<RentalObjectTypeResult | null> {
  const rentalObject = await prisma.rentalObject.findFirst({
    where: {
      rentalObjectCode: rentalId,
    },
    select: {
      rentalObjectType: {
        select: {
          rentalObjectTypeCode: true,
          name: true,
        },
      },
    },
  })

  if (!rentalObject) return null

  return {
    code: rentalObject.rentalObjectType.rentalObjectTypeCode.trim(),
    name: rentalObject.rentalObjectType.name?.trim() ?? null,
  }
}
