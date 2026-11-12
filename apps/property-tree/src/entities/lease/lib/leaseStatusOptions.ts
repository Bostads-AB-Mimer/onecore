export const leaseStatusOptions = [
  { label: 'Gällande', value: 'current' },
  { label: 'Kommande', value: 'upcoming' },
  { label: 'Uppsagd', value: 'abouttoend' },
  { label: 'Upphört', value: 'ended' },
  { label: 'Prel. uppsagt', value: 'preliminaryterminated' },
  { label: 'Inväntar signering', value: 'pendingsignature' },
  { label: 'Ej skickat', value: 'notsent' },
] as const
