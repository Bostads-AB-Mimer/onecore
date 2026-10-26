// Display formatting shared by the Bostad pages. Missing values show as a dash.

export const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('sv-SE') : '–'

export const formatRent = (amount: number | null) =>
  amount === null ? '–' : `${Math.round(amount).toLocaleString('sv-SE')} kr/mån`

// Tenfast tenure names are long; short labels by code, name as fallback.
const TENURE_LABELS: Record<string, string> = {
  STD: 'Standard',
  STUD: 'Student',
}

export const tenureLabel = (tenure: { id: string; name: string } | null) =>
  tenure ? (TENURE_LABELS[tenure.id] ?? tenure.name) : '–'
