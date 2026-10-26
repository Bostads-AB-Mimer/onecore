import type { BostadListing } from './useBostadListing'

// The queue-based (poängsatt) letting process, one tab per stage after publishing.
export const POANGSATT_TABS = [
  { value: 'publicerat-nu', label: 'Publicerat nu' },
  { value: 'erbjud-visning', label: 'Erbjud visning' },
  { value: 'visning', label: 'Visning' },
  { value: 'erbjud-kontrakt', label: 'Erbjud kontrakt' },
  { value: 'historik', label: 'Historik' },
] as const

export type PoangsattStage = (typeof POANGSATT_TABS)[number]['value']

// Listing status (ListingStatus in @onecore/types) to the stage it is shown
// under. Draft listings are not published yet and live on the Bostad page.
// Expired and the assigned/closed mapping follow the parking flow; revisit
// when the later stages are built (UTH-363, UTH-364).
const STAGE_BY_LISTING_STATUS: Record<
  BostadListing['status'],
  PoangsattStage | undefined
> = {
  1: 'publicerat-nu', // Active
  4: 'erbjud-visning', // Expired: published period over, ready for offers
  2: 'historik', // Assigned
  3: 'historik', // Closed
  5: undefined, // Draft
}

export const stageForListingStatus = (status: BostadListing['status']) =>
  STAGE_BY_LISTING_STATUS[status]

export const stageLabel = (stage: PoangsattStage) =>
  POANGSATT_TABS.find((tab) => tab.value === stage)?.label ?? stage
