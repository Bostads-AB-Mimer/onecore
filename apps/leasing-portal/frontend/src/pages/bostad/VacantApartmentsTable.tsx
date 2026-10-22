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
  return <Badge variant="secondary">Utkast</Badge>
}

const buildColumns = (
  onEdit: (apartment: VacantApartment) => void
): ResponsiveTableColumn<VacantApartment>[] => [
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
          <DropdownMenuItem onClick={() => onEdit(a)}>
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

  const [editing, setEditing] = useState<VacantApartment | null>(null)
  const columns = useMemo(() => buildColumns(setEditing), [])

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
      <EditListingDialog
        apartment={editing}
        onClose={() => setEditing(null)}
        onSave={() => {
          // TODO(UTH-354): no write endpoint exists yet for the review/publish
          // fields (see core/leasing's /listings routes) — wire this up once
          // that's built instead of persisting anything here.
          setEditing(null)
        }}
      />
    </>
  )
}
