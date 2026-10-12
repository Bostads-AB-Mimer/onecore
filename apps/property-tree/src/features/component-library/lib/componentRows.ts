import type { property } from '@onecore/types'

import type { Component, ComponentSubtype } from '@/services/types'

export type CategoryType = property.ComponentCategoryType

export type ComponentColumnKey =
  | 'location'
  | 'model'
  | 'installed'
  | 'serialNumber'
  | 'specifications'
  | 'quantity'

export const getComponentColumnKeys = (
  categoryType: CategoryType
): ComponentColumnKey[] =>
  categoryType === 'SURFACE'
    ? ['location', 'specifications', 'quantity', 'installed']
    : ['location', 'model', 'installed', 'serialNumber']

export interface ComponentLocation {
  label: string
  rentalId: string | null
  roomCode: string | null
  tooltip: string
}

export const activeInstallation = (component: Component) =>
  component.componentInstallations?.find((i) => !i.deinstallationDate)

export const getComponentLocation = (
  component: Component
): ComponentLocation => {
  const installation = activeInstallation(component)
  if (!installation) {
    return {
      label: 'Ej installerad',
      rentalId: null,
      roomCode: null,
      tooltip: '',
    }
  }

  const structure = installation.propertyObject?.propertyStructures?.[0]
  if (!structure) {
    return { label: '-', rentalId: null, roomCode: null, tooltip: '' }
  }

  return {
    label: [
      structure.residenceCode,
      structure.roomName || structure.roomCode || 'Okänd',
    ]
      .filter(Boolean)
      .join(' / '),
    rentalId: structure.rentalId ?? null,
    roomCode: structure.roomCode ?? null,
    tooltip: `${structure.residenceName || ''}\nLägenhet: ${structure.rentalId || ''}`,
  }
}

export const getInstallationDate = (component: Component): string | null =>
  activeInstallation(component)?.installationDate ?? null

const UNIT_LABELS: Record<ComponentSubtype['quantityType'], string> = {
  UNIT: 'st',
  METER: 'm',
  SQUARE_METER: 'm²',
  CUBIC_METER: 'm³',
}

export const formatComponentQuantity = (component: Component): string => {
  if (component.quantity === null || component.quantity === undefined) {
    return '-'
  }
  const amount = component.quantity.toLocaleString('sv-SE', {
    maximumFractionDigits: 2,
  })
  const unit = component.subtype
    ? UNIT_LABELS[component.subtype.quantityType]
    : undefined
  return unit ? `${amount} ${unit}` : amount
}
