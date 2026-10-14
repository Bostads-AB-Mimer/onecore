// Floorplans (planritningar) for Mimer's residences are served from a public
// CDN at pub.mimer.nu, keyed by the Xpand rentalId (e.g. "211-001-01-0101").
// The CDN is open — no auth or core-service proxy is involved — so callers
// just need to construct the URL and render it as an <img>, handling the
// onError case when a given rental has no published floorplan.
const FLOORPLAN_CDN_BASE = 'https://pub.mimer.nu/bofaktablad/bofaktablad'

export const getFloorplanUrl = (rentalId: string): string =>
  `${FLOORPLAN_CDN_BASE}/${rentalId}.jpg`
