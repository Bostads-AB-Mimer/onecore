import type { Component } from '@/services/types'

import { formatComponentModelName } from '@/shared/lib/componentLabels'
import { formatISODate } from '@/shared/lib/formatters'

export const instanceOptionTitle = (instance: Component): string => {
  const name =
    formatComponentModelName(instance.model) ||
    instance.specifications?.trim() ||
    'Ingen modell'
  return instance.serialNumber ? `${name} · ${instance.serialNumber}` : name
}

export const instanceOptionDetails = (instance: Component): string =>
  [
    `Skapad ${formatISODate(instance.createdAt)}`,
    instance.warrantyMonths ? `Garanti: ${instance.warrantyMonths} mån` : null,
    instance.priceAtPurchase
      ? `Pris: ${instance.priceAtPurchase.toLocaleString('sv-SE')} kr`
      : null,
  ]
    .filter(Boolean)
    .join(' | ')
