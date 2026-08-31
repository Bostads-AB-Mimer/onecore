import type { RentalPropertyInfo } from '@onecore/types'

export const getPropertyIdentifier = (
  rentalProperty: RentalPropertyInfo | null
) => {
  if (!rentalProperty) return 'Data ej tillgänglig'

  const type = rentalProperty.type
  const property = rentalProperty.property

  if (type === 'Lägenhet' && 'number' in property) {
    return property.number || ''
  }
  if (type === 'Bilplats') {
    return property.code || ''
  }
  // Default fallback for other types
  return ('number' in property && property.number) || property.code || ''
}
