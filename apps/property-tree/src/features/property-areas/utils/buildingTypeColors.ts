// Mimer's official color coding for building types
// Based on their customer-facing branding

export interface BuildingTypeStyle {
  bg: string
  text: string
  label: string
}

export const BUILDING_TYPE_STYLES: Record<string, BuildingTypeStyle> = {
  STD: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    label: 'Standard',
  },
  BLOCK: {
    bg: 'bg-slate-200',
    text: 'text-slate-800',
    label: 'Block',
  },
  '55PLUS': {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    label: '55+',
  },
  STUD: {
    bg: 'bg-amber-400',
    text: 'text-black',
    label: 'Student',
  },
  TRYGG: {
    bg: 'bg-teal-400',
    text: 'text-black',
    label: 'Trygghetsboende',
  },
  'CO-LIVING': {
    bg: 'bg-rose-200',
    text: 'text-rose-900',
    label: 'Co-living',
  },
  KOOPERATIV: {
    bg: 'bg-rose-200',
    text: 'text-rose-900',
    label: 'Kooperativ',
  },
  POANGFRITT: {
    bg: 'bg-orange-400',
    text: 'text-black',
    label: 'Poängfri',
  },
}

export function getBuildingTypeStyle(
  code: string | undefined
): BuildingTypeStyle | null {
  if (!code) return null
  return (
    BUILDING_TYPE_STYLES[code] || {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      label: code,
    }
  )
}
