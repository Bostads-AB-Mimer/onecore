/**
 * Cost Responsibility Constants
 *
 * Per-component cost responsibility used in inspection forms.
 * Values are stored as the enum strings on the backend (English); rendered
 * in Swedish in the UI via COST_RESPONSIBILITY_LABEL.
 */

export const COST_RESPONSIBILITY = {
  TENANT: 'tenant',
  LANDLORD: 'landlord',
} as const

export type CostResponsibility =
  | (typeof COST_RESPONSIBILITY)[keyof typeof COST_RESPONSIBILITY]
  | null

export const COST_RESPONSIBILITY_LABEL: Record<
  Exclude<CostResponsibility, null>,
  string
> = {
  [COST_RESPONSIBILITY.TENANT]: 'Hyresgäst',
  [COST_RESPONSIBILITY.LANDLORD]: 'Hyresvärd',
}
