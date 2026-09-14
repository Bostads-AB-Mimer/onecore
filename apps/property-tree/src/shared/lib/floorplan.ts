// Floorplans (planritningar / bofaktablad) for Mimer's residences are served
// from the onecore-public MinIO bucket, keyed by the Xpand rentalId
// (e.g. "211-001-01-0101"). The bucket has an anonymous read policy applied
// in services/file-storage, so callers just construct the URL and render it
// as an <img>, handling the onError case when a given rental has no
// published floorplan.
//
// The base URL is environment-driven (window.__ENV → import.meta.env → dev
// default) so dev, test and prod can each point at their own MinIO endpoint.
import { resolve } from './env'

const PUBLIC_ASSETS_URL = resolve(
  'VITE_PUBLIC_ASSETS_URL',
  'http://localhost:9000/onecore-public'
)

export const getFloorplanUrl = (rentalId: string): string =>
  `${PUBLIC_ASSETS_URL}/bofaktablad/${rentalId}.jpg`
