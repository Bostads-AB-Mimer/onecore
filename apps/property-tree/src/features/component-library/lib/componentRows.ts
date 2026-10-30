import type { property } from '@onecore/types'

import { isKnownInstallationDate } from '@/entities/component/lib/componentCalculations'

import type { Component, ComponentSubtype } from '@/services/types'

import { formatISODate } from '@/shared/lib/formatters'

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

type PropertyStructure = NonNullable<
  NonNullable<
    NonNullable<Component['componentInstallations']>[number]['propertyObject']
  >['propertyStructures']
>[number]

export interface PlaceLabel {
  address: string | null
  detail: string
}

export interface ComponentLocation extends PlaceLabel {
  rentalId: string | null
  roomCode: string | null
}

export const activeInstallation = (component: Component) =>
  component.componentInstallations?.find((i) => !i.deinstallationDate)

export const describeStructure = (
  structure:
    | Pick<
        PropertyStructure,
        'residenceCode' | 'residenceName' | 'roomName' | 'roomCode'
      >
    | null
    | undefined
): PlaceLabel => {
  if (!structure) return { address: null, detail: '-' }
  return {
    address: structure.residenceName || null,
    detail: [
      structure.residenceCode,
      structure.roomName || structure.roomCode || 'Okänd',
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

export const getComponentLocation = (
  component: Component
): ComponentLocation => {
  const installation = activeInstallation(component)
  if (!installation) {
    return {
      address: null,
      detail: 'Ej installerad',
      rentalId: null,
      roomCode: null,
    }
  }

  const structure = installation.propertyObject?.propertyStructures?.[0]
  return {
    ...describeStructure(structure),
    rentalId: structure?.rentalId ?? null,
    roomCode: structure?.roomCode ?? null,
  }
}

export const formatComponentPlace = (component: Component): string => {
  const { address, detail } = getComponentLocation(component)
  return address ? `${address}, ${detail}` : detail
}

export const getInstallationDate = (component: Component): string | null =>
  activeInstallation(component)?.installationDate ?? null

export const QUANTITY_UNIT_LABELS: Record<
  ComponentSubtype['quantityType'],
  string
> = {
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
    ? QUANTITY_UNIT_LABELS[component.subtype.quantityType]
    : undefined
  return unit ? `${amount} ${unit}` : amount
}

export const formatInstallationDate = (
  isoDate: string | null | undefined
): string =>
  isoDate && !isKnownInstallationDate(isoDate)
    ? 'Okänt'
    : formatISODate(isoDate)

// The imports write 0 for unknown prices and lifespans; they sort as blanks.
export const knownNumber = (value: number) => value || null

export const formatComponentCount = (count: number | undefined): string =>
  count === undefined ? '-' : count.toLocaleString('sv-SE')

export const formatSek = (value: number | null | undefined): string =>
  value
    ? value.toLocaleString('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0,
      })
    : '-'

export const formatWithUnit = (
  value: number | null | undefined,
  unit: string
): string =>
  value
    ? `${value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} ${unit}`
    : '-'
