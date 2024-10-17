import { Box, IconButton, Stack, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import { type GridColDef } from '@mui/x-data-grid'
import Chevron from '@mui/icons-material/ChevronRight'
import {
  GetListingWithApplicantFilterByType,
  Listing,
  ListingStatus,
} from 'onecore-types'
import { Link, useSearchParams } from 'react-router-dom'
import { TabContext, TabPanel } from '@mui/lab'

import { DataGridTable, SearchBar, Tab, Tabs } from '../../components'
import { useParkingSpaceListings } from './hooks/useParkingSpaceListings'
import * as utils from '../../utils'
import { CreateApplicantForListing } from './components/create-applicant-for-listing/CreateApplicantForListing'
import { SyncInternalParkingSpaces } from './components/SyncInternalParkingSpaces'
import { DeleteListing } from './components/DeleteListing'

const ParkingSpaces = () => {
  const [searchString, setSearchString] = useState<string>()
  const [searchParams, setSearchParams] = useSearchParams({ type: 'published' })

  const currentTypeSearchParam =
    (searchParams.get('type') as GetListingWithApplicantFilterByType) ??
    'published'

  const [selectedTab, setSelectedTab] =
    useState<GetListingWithApplicantFilterByType>(currentTypeSearchParam)

  const parkingSpaces = useParkingSpaceListings(currentTypeSearchParam)

  const handleSearch = useCallback((v: string) => setSearchString(v), [])
  const onSearch = useMemo(
    () => utils.debounce(handleSearch, 300),
    [handleSearch]
  )

  const handleTabChange = (
    _e: React.SyntheticEvent,
    tab: GetListingWithApplicantFilterByType
  ) => {
    setSearchParams({ type: tab })
    setSelectedTab(tab)
  }

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
      <TabContext value={selectedTab}>
        <Tabs onChange={handleTabChange}>
          <Tab disableRipple label="Publicerade" value="published" />
          <Tab
            disableRipple
            label="Klara för erbjudande"
            value="ready-for-offer"
          />
          <Tab disableRipple label="Erbjudna" value="offered" />
          <Tab disableRipple label="Historik" value="historical" />
        </Tabs>
        <Box paddingTop="1rem">
          <TabPanel value="published" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter)}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="published"
            />
          </TabPanel>
          <TabPanel value="ready-for-offer" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter)}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="ready-for-offer"
            />
          </TabPanel>
          <TabPanel value="offered" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter)}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="offered"
            />
          </TabPanel>
          <TabPanel value="historical" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter)}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="historical"
            />
          </TabPanel>
        </Box>
      </TabContext>
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
    pageSizeOptions={[5, 10, 25]}
    slots={{
      noRowsOverlay: () => (
        <Stack paddingTop="1rem" alignItems="center" justifyContent="center">
          <Typography fontSize="14px">
            Det finns inga annonser att visa...
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

const getColumns = (
  dateFormatter: Intl.DateTimeFormat,
  numberFormatter: Intl.NumberFormat
): Array<GridColDef<Listing>> => {
  return [
    {
      field: 'address',
      headerName: 'Bilplats',
      ...sharedColumnProps,
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
      ...sharedColumnProps,
    },
    {
      field: 'objectTypeCaption',
      headerName: 'Bilplatstyp',
      ...sharedColumnProps,
    },
    {
      field: 'waitingListType',
      headerName: 'Kötyp',
      ...sharedColumnProps,
    },
    {
      field: 'monthlyRent',
      headerName: 'Hyra',
      ...sharedColumnProps,
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
      valueFormatter: (v) => dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'vacantFrom',
      headerName: 'Ledig FR.O.M',
      ...sharedColumnProps,
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
          disabled={row.status !== ListingStatus.Active}
          id={row.id}
        />,
        <CreateApplicantForListing
          key={1}
          disabled={row.status !== ListingStatus.Active}
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
