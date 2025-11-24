import { type GridColDef } from '@mui/x-data-grid'
import { ListingWithOffer } from '../hooks/useParkingSpaceListings'
import {
  printListingStatus,
  printVacantFrom,
} from '../../../common/formattingUtils'
import { CloseListing } from '../components/CloseListing'
import { CreateApplicantForListing } from '../components/create-applicant-for-listing/CreateApplicantForListing'
import {
  GetListingWithApplicantFilterByType,
  ListingStatus,
} from '@onecore/types'
import { Link } from 'react-router-dom'
import { IconButton } from '@mui/material'
import Chevron from '@mui/icons-material/ChevronRight'
import currency from 'currency.js'

export const sharedColumnProps = {
  editable: false,
  flex: 1,
}

export const getColumns = (
  dateFormatter: Intl.DateTimeFormat,
  numberFormatter: Intl.NumberFormat
): Array<GridColDef<ListingWithOffer>> => {
  return [
    {
      field: 'address',
      headerName: 'Bilplats',
      ...sharedColumnProps,
      flex: 1.25,
      valueGetter: (params) => params.row.rentalObject?.address ?? 0,
      renderCell: (v) => (
        <span>
          <span style={{ display: 'block' }}>{v.row.rentalObject.address}</span>
          {v.row.rentalObjectCode}
        </span>
      ),
    },
    {
      field: 'districtCaption',
      headerName: 'Distrikt',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.rentalObject?.districtCaption ?? '',
      flex: 0.6,
    },
    {
      field: 'residentialAreaCaption',
      headerName: 'Område',
      ...sharedColumnProps,
      valueGetter: (params) =>
        params.row.rentalObject?.residentialAreaCaption ?? '',
    },
    {
      field: 'objectTypeCaption',
      headerName: 'Bilplatstyp',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.rentalObject?.objectTypeCaption ?? '',
    },
    {
      field: 'rentalRule',
      headerName: 'Uthyrningsmetod',
      ...sharedColumnProps,
      valueGetter: (params) => {
        if (params.row.rentalRule === 'NON_SCORED') return 'Poängfri'
        if (params.row.rentalRule === 'SCORED') return 'Intern'
        return ''
      },
      flex: 0.7,
    },
    {
      field: 'monthlyRent',
      headerName: 'Hyra',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.rentalObject?.monthlyRent ?? 0,
      renderCell: (v) => {
        const rent = v.row.rentalObject?.monthlyRent ?? 0
        const showInclVat = v.row.rentalRule === 'NON_SCORED'
        return (
          <span>
            <span style={{ display: 'block' }}>
              {`${numberFormatter.format(rent)}/mån`}
            </span>
            {showInclVat && (
              <span>
                {`${numberFormatter.format(currency(rent).multiply(1.25).value)}/mån inkl. moms`}
              </span>
            )}
          </span>
        )
      },
    },
    {
      field: 'applicants',
      headerName: 'Sökande',
      ...sharedColumnProps,
      flex: 0.5,
      valueGetter: (v) => (v.row.rentalRule == 'SCORED' ? v.value.length : '-'),
    },
    {
      field: 'publishedTo',
      headerName: 'Publicerad T.O.M',
      ...sharedColumnProps,
      valueFormatter: (v) =>
        v.value ? dateFormatter.format(new Date(v.value)) : '-',
      flex: 0.6,
    },
    {
      field: 'vacantFrom',
      headerName: 'Ledig FR.O.M',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.rentalObject?.vacantFrom ?? '',
      valueFormatter: (v) => printVacantFrom(dateFormatter, v.value),
      flex: 0.6,
    },
  ]
}

export const getActionColumns = (): Array<GridColDef<ListingWithOffer>> => {
  return [
    {
      field: 'actions',
      type: 'actions',
      flex: 1,
      minWidth: 250,
      cellClassName: 'actions',
      getActions: ({ row }) => {
        if (
          row.status === ListingStatus.Active ||
          row.status === ListingStatus.Expired
        ) {
          return [
            <CloseListing
              key={1}
              listingId={row.id}
              currentStatus={row.status}
            />,
            <CreateApplicantForListing
              key={1}
              disabled={row.status !== ListingStatus.Active}
              listing={row}
            />,
          ]
        } else {
          return []
        }
      },
    },
    {
      field: 'action-link',
      headerName: '',
      sortable: false,
      filterable: false,
      flex: 0.5,
      disableColumnMenu: true,
      renderCell: (v) => (
        <Link to={`/bilplatser/${v.id}`}>
          <IconButton sx={{ color: 'black' }}>
            <Chevron />
          </IconButton>
        </Link>
      ),
    },
  ]
}

export const getOfferedColumns = (
  dateFormatter: Intl.DateTimeFormat,
  numberFormatter: Intl.NumberFormat
) =>
  getColumns(dateFormatter, numberFormatter).concat([
    {
      field: 'offer.expiresAt',
      headerName: 'Sista svarsdatum',
      ...sharedColumnProps,
      valueGetter: (v) => v.row.offer?.expiresAt,
      valueFormatter: (v) =>
        v.value ? dateFormatter.format(new Date(v.value)) : 'N/A',
    },
  ])

export const getSearchColumns = (
  dateFormatter: Intl.DateTimeFormat,
  numberFormatter: Intl.NumberFormat
): Array<GridColDef<ListingWithOffer>> => {
  const columns = getColumns(dateFormatter, numberFormatter)
  const statusColumn: GridColDef<ListingWithOffer> = {
    field: 'status',
    headerName: 'Status',
    ...sharedColumnProps,
    valueGetter: (params) => params.row.status ?? '',
    valueFormatter: (v) => printListingStatus(v.value as ListingStatus),
    flex: 0.6,
  }

  columns.splice(5, 0, statusColumn)
  return columns
}

const tabMap: Record<
  GetListingWithApplicantFilterByType,
  GetListingWithApplicantFilterByType
> = {
  'ready-for-offer': 'ready-for-offer',
  published: 'published',
  offered: 'offered',
  historical: 'historical',
  all: 'all',
  closed: 'closed',
}

export const getTab = (
  v: string | null
): GetListingWithApplicantFilterByType => {
  if (!v) return 'published'
  if (v in tabMap) {
    return v as GetListingWithApplicantFilterByType
  } else {
    return 'published'
  }
}
