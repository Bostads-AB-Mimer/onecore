import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  BulkActionBar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ResponsiveTable,
  type ResponsiveTableColumn,
  Skeleton,
  useRowSelection,
} from '@onecore/ui'
import { MoreHorizontal } from 'lucide-react'

import { QueryError } from '../QueryError'
import { EditListingDialog } from './EditListingDialog'
import { useCreateListing } from './useCreateListing'
import {
  useVacantApartments,
  type VacantApartment,
} from './useVacantApartments'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('sv-SE') : '–'

const formatRent = (amount: number) =>
  `${Math.round(amount).toLocaleString('sv-SE')} kr/mån`

// Tenfast tenure names are long; short labels by code, name as fallback.
const TENURE_LABELS: Record<string, string> = {
  STD: 'Standard',
  STUD: 'Student',
}

const tenureLabel = (tenure: VacantApartment['rentalTenureType']) =>
  tenure ? (TENURE_LABELS[tenure.id] ?? tenure.name) : '–'

/** Draft listings are the only ones that can appear here; everything else is excluded upstream. */
function ListingBadge({ listing }: { listing: VacantApartment['listing'] }) {
  if (!listing) return <Badge variant="outline">Ingen annons</Badge>
  if (listing.reviewedAt) {
    return <Badge variant="success">Redo att publicera</Badge>
  }
  return <Badge variant="priority-medium">Behöver granskning</Badge>
}

// Approximated from the design's colors with the variants @onecore/ui already
// has — not a 1:1 palette match, but close enough without adding new ones.
const TENURE_BADGE_VARIANTS: Record<
  string,
  'outline' | 'priority-medium' | 'priority-high' | 'success'
> = {
  Standard: 'outline',
  Student: 'priority-medium',
  'Co-living': 'priority-high',
  Trygghetsboende: 'success',
}

function TenureBadge({
  tenure,
}: {
  tenure: VacantApartment['rentalTenureType']
}) {
  const label = tenureLabel(tenure)
  return (
    <Badge variant={TENURE_BADGE_VARIANTS[label] ?? 'outline'}>{label}</Badge>
  )
}

const buildColumns = (
  onEdit: (apartment: VacantApartment) => void,
  creatingFor: string | null
): ResponsiveTableColumn<VacantApartment>[] => [
  {
    key: 'address',
    label: 'Adress',
    render: (a) => (
      <>
        {a.address?.street ?? '–'}
        <span className="block text-xs text-muted-foreground">
          {a.rentalObjectCode}
        </span>
      </>
    ),
  },
  { key: 'area', label: 'Område', render: (a) => a.marketAreaName ?? '–' },
  { key: 'type', label: 'Typ', render: (a) => a.residenceTypeName ?? '–' },
  { key: 'rooms', label: 'Rum', render: (a) => a.roomCount ?? '–' },
  {
    key: 'size',
    label: 'Yta',
    render: (a) => (a.area != null ? `${a.area} m²` : '–'),
  },
  { key: 'rent', label: 'Hyra', render: (a) => formatRent(a.rent) },
  {
    key: 'tenure',
    label: 'Hyresobjektstyp',
    render: (a) => <TenureBadge tenure={a.rentalTenureType} />,
  },
  {
    key: 'rentalMethod',
    label: 'Senaste uthyrningsmetod',
    // A separate Tenfast fact from rentalTenureType, not another value for
    // the same column — e.g. "Poängfri" alongside a "Student" tenure type.
    render: (a) =>
      a.rentalTags.length > 0 ? (
        <Badge variant="secondary">{a.rentalTags[0].name}</Badge>
      ) : (
        '–'
      ),
  },
  {
    key: 'vacantFrom',
    label: 'Tillgänglig från',
    render: (a) => (
      <>
        {/* availableFrom overrides the computed vacantFrom when a leasing
            officer has set one via "Redigera annons". */}
        {formatDate(a.listing?.availableFrom ?? a.vacantFrom)}
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
    label: 'Status',
    render: (a) => <ListingBadge listing={a.listing} />,
  },
  {
    key: 'attempts',
    label: 'Tidigare försök',
    render: (a) => a.closedListingsSinceLastLease,
  },
  {
    key: 'actions',
    label: '',
    className: 'w-10',
    render: (a) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            aria-label="Fler alternativ"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Not built yet — see UTH-356. */}
          <DropdownMenuItem disabled>Publicera</DropdownMenuItem>
          {/* Creates a draft listing first if the apartment doesn't have one yet. */}
          <DropdownMenuItem
            disabled={creatingFor === a.rentalObjectCode}
            onClick={() => onEdit(a)}
          >
            Redigera annons
          </DropdownMenuItem>
          {/* No deletion flow exists yet. */}
          <DropdownMenuItem disabled className="text-destructive">
            Ta bort
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
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

  const [editing, setEditing] = useState<VacantApartment | null>(null)
  const createListing = useCreateListing()

  const handleEdit = (apartment: VacantApartment) => {
    if (apartment.listing) {
      setEditing(apartment)
      return
    }
    createListing.mutate(apartment.rentalObjectCode, {
      onSuccess: (listing) => setEditing({ ...apartment, listing }),
    })
  }

  const columns = useMemo(
    () =>
      buildColumns(
        handleEdit,
        createListing.isPending ? createListing.variables : null
      ),
    [createListing.isPending, createListing.variables]
  )

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
        columns={columns}
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
      <EditListingDialog apartment={editing} onClose={() => setEditing(null)} />
    </>
  )
}
