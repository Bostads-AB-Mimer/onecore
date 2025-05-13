export const housingFieldMatrix: Record<string, readonly string[]> = {
  ['RENTAL']: [
    'landlord',
    'numAdults',
    'numChildren',
    'housingReference.phone',
    'housingReference.email',
  ],
  ['LIVES_WITH_FAMILY']: [
    'landlord',
    'numAdults',
    'numChildren',
    'housingReference.phone',
    'housingReference.email',
  ],
  ['LODGER']: ['numAdults', 'numChildren'],
  ['OWNS_HOUSE']: ['numAdults', 'numChildren'],
  ['OWNS_FLAT']: ['numAdults', 'numChildren'],
  ['OWNS_ROW_HOUSE']: ['numAdults', 'numChildren'],
  ['OTHER']: [
    'housingTypeDescription',
    'numAdults',
    'numChildren',
    'housingReference.phone',
  ],
} as const

export const reviewStatusFieldMatrix: Record<string, readonly string[]> = {
  ['APPROVED']: [],
  ['REJECTED']: [
    'housingReference.reasonRejected',
    'housingReference.expiresAt',
  ],
  ['CONTACTED_UNREACHABLE']: [],
  ['REFERENCE_NOT_REQUIRED']: [],
  ['PENDING']: [],
} as const
