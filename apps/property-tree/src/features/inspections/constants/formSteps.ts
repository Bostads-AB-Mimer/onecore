/**
 * Steps in the inspection form, shared between desktop (InspectionForm) and
 * mobile (MobileInspectionForm) so the two views stay in sync as the flow
 * evolves.
 *
 * - rooms: walkthrough of each room
 * - checklist: MIM-1818 "Kontrollfrågor" (tenant + furniture + safety checks)
 * - summary: final remarks table before submitting
 */
export const FORM_STEP = {
  ROOMS: 'rooms',
  CHECKLIST: 'checklist',
  SUMMARY: 'summary',
} as const

export type FormStep = (typeof FORM_STEP)[keyof typeof FORM_STEP]
