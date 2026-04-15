/**
 * Detail Component Options
 *
 * Hardcoded list of detail component types that can be added
 * to the "Detaljer" section in the inspection form.
 */

export interface DetailComponentOption {
  type: string
  label: string
}

export const DETAIL_COMPONENT_OPTIONS: readonly DetailComponentOption[] = [
  { type: 'baseboards', label: 'Golvsocklar' },
  { type: 'interiorDoors', label: 'Innerdörrar' },
  { type: 'outlets', label: 'Eluttag' },
  { type: 'switches', label: 'Strömbrytare' },
  { type: 'windowSills', label: 'Fönsterbänkar' },
  { type: 'windowFrames', label: 'Fönsterkarmar' },
  { type: 'radiators', label: 'Radiatorer' },
  { type: 'ventilation', label: 'Ventilation' },
  { type: 'shelving', label: 'Hyllor/skåp' },
  { type: 'curtainRods', label: 'Gardinstänger' },
  { type: 'lighting', label: 'Belysning' },
] as const
