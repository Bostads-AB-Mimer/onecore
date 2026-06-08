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

export const CHECKLIST_DEFAULT: Checklist = {
  groundFaultBreaker: false,
  smokeDetector: false,
  electricalSchema: false,
  electricalSystem: false,
}

export const CHECKLIST_ITEMS: ReadonlyArray<{
  key: keyof Checklist
  label: string
}> = [
  { key: 'groundFaultBreaker', label: 'Jordfelsbrytare' },
  { key: 'smokeDetector', label: 'Brandvarnare' },
  { key: 'electricalSchema', label: 'Elschema' },
  { key: 'electricalSystem', label: 'Elsystem (ockulär)' },
] as const
