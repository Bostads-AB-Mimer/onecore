import type { Component } from '@/services/types'

export const formatComponentCurrency = (
  value: number | null | undefined,
  locale: string = 'sv-SE'
): string => {
  if (value === null || value === undefined) return '-'
  return `${value.toLocaleString(locale)} kr`
}

// The component imports write 1900-01-01 when Xpand has no installation date.
const LAST_PLACEHOLDER_YEAR = 1900

export const isKnownInstallationDate = (
  installationDate: string | null | undefined
): installationDate is string =>
  !!installationDate &&
  new Date(installationDate).getUTCFullYear() > LAST_PLACEHOLDER_YEAR

export const calculateComponentAge = (
  installationDate: string | null | undefined
): number | null => {
  if (!isKnownInstallationDate(installationDate)) return null
  const installed = new Date(installationDate)
  const now = new Date()
  const beforeAnniversary =
    now.getUTCMonth() < installed.getUTCMonth() ||
    (now.getUTCMonth() === installed.getUTCMonth() &&
      now.getUTCDate() < installed.getUTCDate())
  const years =
    now.getUTCFullYear() -
    installed.getUTCFullYear() -
    (beforeAnniversary ? 1 : 0)
  return years >= 0 ? years : 0
}

export const knownLifespan = (years: number | null | undefined) =>
  years ? years : null

export const componentEconomicLifespan = (component: Component) =>
  knownLifespan(component.economicLifespan) ??
  knownLifespan(component.subtype?.economicLifespan)

export type WarrantyState = 'active' | 'expired' | 'unknown'

export const calculateComponentWarrantyStatus = (
  component: Component
): { state: WarrantyState; remaining: string; expiryDate: Date | null } => {
  if (!component.warrantyStartDate || !component.warrantyMonths) {
    return { state: 'unknown', remaining: '', expiryDate: null }
  }

  const startDate = new Date(component.warrantyStartDate)
  const expiryDate = new Date(startDate)
  expiryDate.setMonth(expiryDate.getMonth() + component.warrantyMonths)

  const now = new Date()
  if (expiryDate <= now) {
    return { state: 'expired', remaining: 'Utgången', expiryDate }
  }

  const monthsRemaining = Math.round(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
  )
  const yearsRemaining = Math.floor(monthsRemaining / 12)

  let remaining = ''
  if (yearsRemaining >= 1) {
    remaining = `${yearsRemaining} år kvar`
  } else {
    remaining = `${monthsRemaining} mån kvar`
  }

  return { state: 'active', remaining, expiryDate }
}

export const getComponentStatusConfig = (status: string | undefined) => {
  if (!status) return { label: '-', color: 'gray' as const }

  const statusMap: Record<
    string,
    { label: string; color: 'green' | 'yellow' | 'red' | 'gray' }
  > = {
    ACTIVE: { label: 'Aktiv', color: 'green' },
    MAINTENANCE: { label: 'Underhåll', color: 'yellow' },
    DECOMMISSIONED: { label: 'Ur drift', color: 'red' },
    INACTIVE: { label: 'Inaktiv', color: 'gray' },
  }

  return statusMap[status] || { label: status, color: 'gray' }
}

export const calculateComponentLifespanProgress = (
  component: Component
): { age: number; percentage: number; remaining: number } | null => {
  const installation = component.componentInstallations?.[0]
  const age = calculateComponentAge(installation?.installationDate)
  const technicalLife = knownLifespan(component.subtype?.technicalLifespan)

  if (age === null || !technicalLife) return null

  const percentage = Math.min((age / technicalLife) * 100, 100)
  return {
    age,
    percentage,
    remaining: Math.max(technicalLife - age, 0),
  }
}

export const componentNeedsAttention = (component: Component) => {
  const { color } = getComponentStatusConfig(component.status)
  if (color === 'yellow' || color === 'red') return true
  const progress = calculateComponentLifespanProgress(component)
  return progress !== null && progress.percentage >= 100
}
