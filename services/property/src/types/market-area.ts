import { property } from '@onecore/types'

// Shared vocabulary (libs/types) — re-exported so local consumers keep their
// existing imports; do not re-declare it here.
export const { MarketAreaSchema } = property
export type MarketArea = property.MarketArea
