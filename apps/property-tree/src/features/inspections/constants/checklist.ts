import { inspection } from '@onecore/types'

import type { components } from '@/services/api/core/generated/api-types'

/**
 * Inspector-driven safety/utility checks captured in the "Kontrollfrågor"
 * step. Derived from the swagger so the shape stays in sync with the backend
 * schema — see registerSchema('Checklist', …) in services/inspection. Once
 * that registration ships, this becomes a direct
 * `components['schemas']['Checklist']` reference; until then we derive it from
 * the field on InternalInspection where the type is inlined.
 *
 * Required<> because the zod schema applies defaults — every key is populated
 * after parse, even though the swagger marks each as optional on the wire.
 */
export type Checklist = Required<
  NonNullable<components['schemas']['InternalInspection']['checklist']>
>

// Single source of truth in @onecore/types — the same default the backend
// zod schema applies when a persisted inspection has no checklist yet.
export const CHECKLIST_DEFAULT: Checklist = inspection.CHECKLIST_DEFAULT

export const CHECKLIST_ITEMS: ReadonlyArray<{
  key: keyof Checklist
  label: string
}> = [
  { key: 'groundFaultBreaker', label: 'Jordfelsbrytare' },
  { key: 'smokeDetector', label: 'Brandvarnare' },
  { key: 'electricalSchema', label: 'Elschema' },
  { key: 'electricalSystem', label: 'Elsystem (ockulär)' },
] as const
