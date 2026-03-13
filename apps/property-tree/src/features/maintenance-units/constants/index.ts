// All maintenance unit types to display (in order)
export const MAINTENANCE_UNIT_TYPES = [
  {
    label: 'Parkeringsområde',
    description: 'Utomhusparkering för hyresgäster',
  },
  {
    label: 'Lekplats',
    description: 'Lekplats med gungor och klätterställning',
  },
  {
    label: 'Rekreationsytor',
    description: 'Gemensam rekreationsyta för hyresgäster',
  },
  {
    label: 'Återvinning',
    description: 'Sorterat avfall och återvinning',
  },
  {
    label: 'Tvättstugor',
    description: 'Tvätt och torkmaskiner för hyresgäster',
  },
  { label: 'Skyddsrum', description: 'Skyddsrum enligt BBR' },
  { label: 'Förråd', description: 'Förrådsutrymmen för hyresgäster' },
  {
    label: 'Installation',
    description: 'Ventilationsaggregat och värmesystem',
  },
  { label: 'Lås & passage', description: 'Elektroniska lås och passagesystem' },
] as const

// Type mapping for API data to display categories
export const TYPE_CONFIG: Record<string, string> = {
  Tvättstuga: 'Tvättstugor',
  Miljöbod: 'Återvinning',
  Sopskåp: 'Återvinning',
  Skyddsrum: 'Skyddsrum',
  Lekplats: 'Lekplats',
  'Undercentral Värme': 'Installation',
  'Undercentral Ventilation': 'Installation',
  'Undercentral Data/IT': 'Installation',
  'Lås & passage': 'Lås & passage',
}
