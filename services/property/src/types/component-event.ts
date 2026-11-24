import { property } from '@onecore/types'

// ==================== COMPONENT EVENTS ====================

// Shared vocabulary (libs/types) — re-exported so swagger.ts can register it
// next to the other component schemas; do not re-declare it here.
export const {
  ComponentEventSchema,
  CreateComponentEventSchema,
  ComponentEventsBySourceQuerySchema,
} = property
