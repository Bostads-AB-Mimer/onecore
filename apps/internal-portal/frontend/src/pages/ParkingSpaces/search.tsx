import { Box, IconButton, Stack, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import { type GridColDef } from '@mui/x-data-grid'
import Chevron from '@mui/icons-material/ChevronRight'
import { Listing, ListingStatus } from '@onecore/types'
import { Link } from 'react-router-dom'

import { DataGridTable, SearchBar } from '../../components'
import {
  ListingWithOffer,
  useParkingSpaceListings,
} from './hooks/useParkingSpaceListings'
import * as utils from '../../utils'
import { CreateApplicantForListing } from './components/create-applicant-for-listing/CreateApplicantForListing'
import { DeleteListing } from './components/DeleteListing'
import {
  printVacantFrom,
  printListingStatus,
} from '../../common/formattingUtils'

const SearchParkingSpaces = () => {
  const [searchString, setSearchString] = useState<string>()

  const parkingSpaces = useParkingSpaceListings('all')

  const handleSearch = useCallback((v: string) => setSearchString(v), [])
  const onSearch = useMemo(
    () => utils.debounce(handleSearch, 300),
    [handleSearch]
  )

  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  return (
    <>
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        paddingBottom="1rem"
      >
        <Typography variant="h1">Sök annons för bilplats</Typography>
        <Box display="flex" flexGrow="1" justifyContent="flex-end" gap="1rem">
          <SearchBar
            onChange={onSearch}
            disabled={parkingSpaces.isLoading}
            placeholder="Sök kundnr, personnr, objektsnr..."
          />
        </Box>
      </Box>
      {parkingSpaces.error && (
        <Typography color="error" paddingTop="1rem" paddingBottom="2rem">
          Ett okänt fel inträffade när parkeringsplatserna skulle hämtas.
        </Typography>
      )}

      <Box paddingTop="1rem">
        <Listings
          columns={getColumns(dateFormatter, numberFormatter).concat(
            getActionColumns()
          )}
          rows={filterListings(parkingSpaces.data ?? [], searchString)}
          loading={parkingSpaces.status === 'pending'}
        />
      </Box>
    </>
  )
}

const Listings = (props: {
  columns: Array<GridColDef>
  rows: Array<Listing>
  loading: boolean
}) => (
  <DataGridTable
    initialState={{
      sorting: {
        sortModel: [{ field: 'queuePoints', sort: 'desc' }],
      },
      pagination: { paginationModel: { pageSize: 30 } },
    }}
    pageSizeOptions={[10, 30, 60, 100]}
    slots={{
      noRowsOverlay: () => (
        <Stack paddingTop="1rem" alignItems="center" justifyContent="center">
          <Typography fontSize="14px">
            Det finns inga annonser att visa.
          </Typography>
        </Stack>
      ),
    }}
    columns={props.columns}
    rows={props.rows}
    getRowId={(row) => row.id}
    loading={props.loading}
    rowHeight={72}
    disableRowSelectionOnClick
    autoHeight
  />
)

const sharedColumnProps = {
  editable: false,
  flex: 1,
}

const getActionColumns = (): Array<GridColDef<ListingWithOffer>> => {
  return [
    {
      field: 'actions',
      type: 'actions',
      flex: 1,
      minWidth: 250,
      cellClassName: 'actions',
      getActions: ({ row }) => [
        <DeleteListing
          key={0}
          address={row.rentalObject.address}
          rentalObjectCode={row.rentalObjectCode}
          disabled={row.status !== ListingStatus.Active}
          id={row.id}
        />,
        <CreateApplicantForListing
          key={1}
          disabled={
            row.status !== ListingStatus.Active ||
            row.rentalRule === 'NON_SCORED'
          }
          listing={row}
        />,
      ],
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

const getColumns = (
  dateFormatter: Intl.DateTimeFormat,
  numberFormatter: Intl.NumberFormat
): Array<GridColDef<ListingWithOffer>> => {
  return [
    {
      field: 'address',
      headerName: 'Bilplats',
      ...sharedColumnProps,
      flex: 1.25,
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
      field: 'status',
      headerName: 'Status',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.status ?? '',
      valueFormatter: (v) => printListingStatus(v.value as ListingStatus),
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
    },
    {
      field: 'monthlyRent',
      headerName: 'Hyra',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.rentalObject?.monthlyRent ?? 0,
      valueFormatter: (v) => `${numberFormatter.format(v.value)}/mån`,
    },
    {
      field: 'applicants',
      headerName: 'Sökande',
      ...sharedColumnProps,
      flex: 0.75,
      valueFormatter: (v) => v.value.length,
    },
    {
      field: 'publishedTo',
      headerName: 'Publicerad T.O.M',
      ...sharedColumnProps,
      valueFormatter: (v) =>
        v.value ? dateFormatter.format(new Date(v.value)) : '-',
    },
    {
      field: 'vacantFrom',
      headerName: 'Ledig FR.O.M',
      ...sharedColumnProps,
      valueGetter: (params) => params.row.rentalObject?.vacantFrom ?? '',
      valueFormatter: (v) => printVacantFrom(dateFormatter, v.value),
    },
  ]
}

const filterListings = (
  listings: Array<Listing>,
  q?: string
): Array<Listing> => {
  if (!q) return listings

  return listings.filter((l) => {
    const containsRentalObjectCode = l.rentalObjectCode
      .toLowerCase()
      .includes(q.toLowerCase())

    if (!l.applicants) return containsRentalObjectCode

    const containsContactCode = l.applicants.some((a) =>
      a.contactCode.toLowerCase().includes(q.toLowerCase())
    )

    const containsNationalRegistrationNumber = l.applicants.some((a) =>
      a.nationalRegistrationNumber?.includes(q)
    )

    return (
      containsContactCode ||
      containsNationalRegistrationNumber ||
      containsRentalObjectCode
    )
  })
}

export default SearchParkingSpaces
