import type { Component } from '@/services/types'

export const formatComponentCurrency = (
  value: number | null | undefined,
  locale: string = 'sv-SE'
): string => {
  if (value === null || value === undefined) return '-'
  return `${value.toLocaleString(locale)} kr`
}

export const calculateComponentAge = (
  installationDate: string | null | undefined
): number | null => {
  if (!installationDate) return null
  const installed = new Date(installationDate)
  const now = new Date()
  const years = now.getFullYear() - installed.getFullYear()
  return years >= 0 ? years : 0
}

export const calculateComponentWarrantyStatus = (component: Component) => {
  if (!component.warrantyStartDate || !component.warrantyMonths) {
    return { active: false, remaining: '', expiryDate: null as Date | null }
  }

  const startDate = new Date(component.warrantyStartDate)
  const expiryDate = new Date(startDate)
  expiryDate.setMonth(expiryDate.getMonth() + component.warrantyMonths)

  const now = new Date()
  const active = expiryDate > now

  if (!active) {
    return { active: false, remaining: 'Utgången', expiryDate }
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

  return { active, remaining, expiryDate }
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
  const technicalLife = component.model?.subtype?.technicalLifespan

  if (age === null || !technicalLife) return null

  const percentage = Math.min((age / technicalLife) * 100, 100)
  return {
    age,
    percentage,
    remaining: Math.max(technicalLife - age, 0),
  }
}
