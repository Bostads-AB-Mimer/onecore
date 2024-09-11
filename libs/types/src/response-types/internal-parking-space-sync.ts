export type InternalParkingSpaceSyncSuccessResponse = {
  invalid: Array<{
    rentalObjectCode: string
    errors: Array<{ path: string; code: string }>
  }>
  insertions: {
    inserted: Array<{ rentalObjectCode: string; id: number }>
    failed: Array<{
      rentalObjectCode: string
      err: 'unknown' | 'active-listing-exists'
    }>
  }
}
