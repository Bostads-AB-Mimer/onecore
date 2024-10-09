import { Box, IconButton, Stack, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import { type GridColDef } from '@mui/x-data-grid'
import Chevron from '@mui/icons-material/ChevronRight'
import { Listing, ListingStatus } from 'onecore-types'
import { Link } from 'react-router-dom'

import { DataGridTable, SearchBar } from '../../components'
import { useParkingSpaceListings } from './hooks/useParkingSpaceListings'
import * as utils from '../../utils'
import { CreateApplicantForListing } from './components/create-applicant-for-listing/CreateApplicantForListing'
import { SyncInternalParkingSpaces } from './components/SyncInternalParkingSpaces'
import { DeleteListing } from './components/DeleteListing'

const sharedProps = {
  editable: false,
  flex: 1,
}

const ParkingSpaces = () => {
  const parkingSpaces = useParkingSpaceListings()
  const [searchString, setSearchString] = useState<string>()
  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  const columns: GridColDef[] = [
    {
      field: 'address',
      headerName: 'Bilplats',
      ...sharedProps,
      flex: 1.25,
      renderCell: (v) => (
        <span>
          <span style={{ display: 'block' }}>{v.row.address}</span>
          {v.row.rentalObjectCode}
        </span>
      ),
    },
    {
      field: 'districtCaption',
      headerName: 'Område',
      ...sharedProps,
    },
    {
      field: 'rentalObjectTypeCaption',
      headerName: 'Bilplatstyp',
      ...sharedProps,
    },
    {
      field: 'waitingListType',
      headerName: 'Typ',
      ...sharedProps,
    },
    {
      field: 'monthlyRent',
      headerName: 'Hyra',
      ...sharedProps,
      valueFormatter: (v) => `${numberFormatter.format(v.value)}/mån`,
    },
    {
      field: 'applicants',
      headerName: 'Sökande',
      ...sharedProps,
      flex: 0.75,
      valueFormatter: (v) => v.value.length,
    },
    {
      field: 'publishedTo',
      headerName: 'Publicerad T.O.M',
      ...sharedProps,
      valueFormatter: (v) => dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'vacantFrom',
      headerName: 'Ledig FR.O.M',
      ...sharedProps,
      valueFormatter: (v) => dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'actions',
      type: 'actions',
      flex: 1,
      minWidth: 250,
      cellClassName: 'actions',
      getActions: ({ row }) => [
        <DeleteListing
          key={0}
          address={row.address}
          rentalObjectCode={row.rentalObjectCode}
          disabled={row.status === ListingStatus.Expired}
          id={row.id}
        />,
        <CreateApplicantForListing
          key={1}
          disabled={row.status === ListingStatus.Expired}
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
        <Link to={`/parkingspace/${v.id}`}>
          <IconButton sx={{ color: 'black' }}>
            <Chevron />
          </IconButton>
        </Link>
      ),
    },
  ]

  const handleSearch = useCallback((v: string) => setSearchString(v), [])
  const onSearch = useMemo(
    () => utils.debounce(handleSearch, 300),
    [handleSearch]
  )

  return (
    <>
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        paddingBottom="2rem"
      >
        <Typography variant="h1">Bilplatser</Typography>
        <Box display="flex" flexGrow="1" justifyContent="flex-end" gap="1rem">
          <SyncInternalParkingSpaces />
          <SearchBar
            onChange={onSearch}
            disabled={parkingSpaces.isLoading}
            placeholder="Sök kundnummer, personnummer..."
          />
        </Box>
      </Box>
      {parkingSpaces.error && 'Error'}
      <DataGridTable
        initialState={{
          sorting: {
            sortModel: [{ field: 'queuePoints', sort: 'desc' }],
          },
          pagination: { paginationModel: { pageSize: 5 } },
        }}
        pageSizeOptions={[5, 10, 25]}
        slots={{
          noRowsOverlay: () => (
            <Stack
              paddingTop="1rem"
              alignItems="center"
              justifyContent="center"
            >
              <Typography fontSize="14px">
                Det finns inga annonser att visa...
              </Typography>
            </Stack>
          ),
        }}
        columns={columns}
        rows={filterListings(parkingSpaces.data ?? [], searchString)}
        getRowId={(row) => row.id}
        loading={parkingSpaces.status === 'pending'}
        rowHeight={72}
        disableRowSelectionOnClick
        autoHeight
      />
    </>
  )
}

const filterListings = (
  listings: Array<Listing>,
  q?: string
): Array<Listing> => {
  if (!q) return listings

  return listings.filter((l) => {
    if (!l.applicants) return false
    const containsContactCode = l.applicants.some((a) =>
      a.contactCode.toLowerCase().includes(q.toLowerCase())
    )

    const containsNationalRegistrationNumber = l.applicants.some((a) =>
      a.nationalRegistrationNumber.includes(q)
    )

    return containsContactCode || containsNationalRegistrationNumber
  })
}

export default ParkingSpaces
