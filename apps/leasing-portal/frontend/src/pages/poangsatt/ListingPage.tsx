import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useParams, useResolvedPath } from 'react-router-dom'
import {
  Badge,
  Button,
  FloorplanImage,
  SegmentedTabs,
  Skeleton,
} from '@onecore/ui'

import { BffRequestError } from '../../api/errors'
import { QueryError } from '../QueryError'
import { ObjectInformation } from './ObjectInformation'
import { POANGSATT_TABS, stageForListingStatus, stageLabel } from './stages'
import { useBostadListing } from './useBostadListing'

/** Where to go back to, when a list in the portal linked here (router state). */
const backTarget = (state: unknown): string | undefined =>
  state &&
  typeof state === 'object' &&
  'from' in state &&
  typeof state.from === 'string'
    ? state.from
    : undefined

/**
 * One apartment listing, at a URL that holds whatever stage the listing is in,
 * so a shared link keeps working. The tab follows the listing's status; Back
 * returns to the list that linked here, or to the list for the current stage.
 */
export function ListingPage() {
  const { listingId = '' } = useParams<{ listingId: string }>()
  const { state } = useLocation()
  const poangsattPath = useResolvedPath('../..', { relative: 'path' }).pathname
  const bostadPath = useResolvedPath('../../..', { relative: 'path' }).pathname
  const {
    data: listing,
    isPending,
    isError,
    error,
  } = useBostadListing(listingId)

  const stage = listing ? stageForListingStatus(listing.status) : undefined
  const backTo =
    backTarget(state) ?? (stage ? `${poangsattPath}/${stage}` : bostadPath)

  return (
    <div className="space-y-6 p-6">
      <SegmentedTabs
        tabs={POANGSATT_TABS}
        value={stage ?? ''}
        basePath={poangsattPath}
      />
      <Button asChild variant="outline" size="sm">
        <Link to={backTo}>
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
      </Button>

      {isError ? (
        error instanceof BffRequestError && error.status === 404 ? (
          <p role="alert" className="py-8 text-center text-muted-foreground">
            Annonsen finns inte.
          </p>
        ) : (
          <QueryError error={error} />
        )
      ) : isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-64 w-full max-w-xl" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{listing.address}</h1>
            <Badge variant="info">
              {stage ? stageLabel(stage) : 'Ej publicerad'}
            </Badge>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            <ObjectInformation listing={listing} />
            <section aria-labelledby="floorplan-heading">
              <h2 id="floorplan-heading" className="text-lg font-semibold">
                Planritning
              </h2>
              <div className="mt-4 rounded-lg border p-4">
                <FloorplanImage rentalId={listing.rentalObjectCode} />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
