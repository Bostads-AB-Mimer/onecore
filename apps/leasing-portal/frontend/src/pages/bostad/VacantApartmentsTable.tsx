import { useEffect } from 'react'
import {
  Badge,
  BulkActionBar,
  ResponsiveTable,
  type ResponsiveTableColumn,
  Skeleton,
  useRowSelection,
} from '@onecore/ui'

import { QueryError } from '../QueryError'
import { formatDate, formatRent, tenureLabel } from './format'
import {
  useVacantApartments,
  type VacantApartment,
} from './useVacantApartments'

/** Draft listings are the only ones that can appear here; everything else is excluded upstream. */
function ListingBadge({ listing }: { listing: VacantApartment['listing'] }) {
  if (!listing) return <Badge variant="outline">Ingen annons</Badge>
  if (listing.reviewedAt) {
    return <Badge variant="success">Redo att publicera</Badge>
  }
  return <Badge variant="secondary">Utkast</Badge>
}

const COLUMNS: ResponsiveTableColumn<VacantApartment>[] = [
  {
    key: 'rentalObjectCode',
    label: 'Objektsnummer',
    className: 'font-mono',
    render: (a) => a.rentalObjectCode,
  },
  {
    key: 'address',
    label: 'Adress',
    render: (a) => a.address?.street ?? '–',
  },
  { key: 'area', label: 'Område', render: (a) => a.marketAreaName ?? '–' },
  { key: 'type', label: 'Typ', render: (a) => a.residenceTypeName ?? '–' },
  {
    key: 'size',
    label: 'Yta',
    render: (a) => (a.area != null ? `${a.area} m²` : '–'),
  },
  { key: 'rent', label: 'Hyra', render: (a) => formatRent(a.rent) },
  {
    key: 'tenure',
    label: 'Upplåtelseform',
    render: (a) => (
      <>
        {tenureLabel(a.rentalTenureType)}
        {a.rentalTags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {a.rentalTags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </span>
        )}
      </>
    ),
  },
  {
    key: 'vacantFrom',
    label: 'Tillgänglig från',
    render: (a) => (
      <>
        {formatDate(a.vacantFrom)}
        {a.block?.reason && (
          <span className="block text-xs text-muted-foreground">
            Spärr: {a.block.reason}
          </span>
        )}
      </>
    ),
  },
  {
    key: 'listing',
    label: 'Annons',
    render: (a) => <ListingBadge listing={a.listing} />,
  },
  {
    key: 'attempts',
    label: 'Tidigare försök',
    render: (a) => a.closedListingsSinceLastLease,
  },
]

const NO_ROWS: VacantApartment[] = []
const getId = (a: VacantApartment) => a.rentalObjectCode

export function VacantApartmentsTable() {
  const { data, isPending, isError, error } = useVacantApartments()
  const selection = useRowSelection(data ?? NO_ROWS, getId)
  // Rows leave this list when they get a listing; a stale tick must not linger.
  const { clear } = selection
  useEffect(() => clear(), [data, clear])

  if (isError) return <QueryError error={error} />

  if (isPending) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <>
      <ResponsiveTable
        data={data}
        columns={COLUMNS}
        keyExtractor={getId}
        selection={selection}
        emptyMessage="Inga lediga lägenheter att publicera"
      />
      {/* Actions arrive with the next step (skapa annons för valda). */}
      <BulkActionBar
        selectedCount={selection.count}
        onClear={selection.clear}
        actions={[]}
      />
    </>
  )
}
