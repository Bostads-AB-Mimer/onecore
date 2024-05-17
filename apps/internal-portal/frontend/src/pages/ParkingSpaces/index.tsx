import { Box, IconButton, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import type { GridColDef } from '@mui/x-data-grid'
import Chevron from '@mui/icons-material/ChevronRight'
import { Listing } from 'onecore-types'
import { Link } from 'react-router-dom'

import { DataGridTable } from '../../components'
import { useParkingSpaces } from './hooks/useParkingSpaces'
import * as utils from '../../utils'
import { mdTheme } from '../../theme'

const sharedProps = {
  editable: false,
  flex: 1,
}

const ParkingSpaces = () => {
  const parkingSpaces = useParkingSpaces()
  const [searchString, setSearchString] = useState<string>()
  const dateFormatter = new Intl.DateTimeFormat('sv-SE')
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
      field: 'action',
      headerName: '',
      sortable: false,
      filterable: false,
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
        justifyContent="space-between"
        alignItems="flex-end"
        paddingBottom="2rem"
      >
        <Typography variant="h1">Bilplatser</Typography>
        <SearchApplicant
          onChange={onSearch}
          disabled={parkingSpaces.isLoading}
          placeholder="Sök kundnummer, personnummer..."
        />
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

type SearchApplicantProps = {
  onChange: (v: string) => void
  disabled: boolean
  placeholder: string
}

const SearchApplicant = (props: SearchApplicantProps) => (
  <TextField
    size="small"
    variant="outlined"
    placeholder={props.placeholder}
    disabled={props.disabled}
    onChange={(e) => props.onChange(e.currentTarget.value)}
    sx={{
      width: '100%',
      maxWidth: 350,
      '& .MuiOutlinedInput-root': {
        fontSize: '16px',
        paddingTop: '2px',
        paddingBottom: '2px',
        color: '#000',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: mdTheme.palette.warmGrey.main,
          borderRadius: '4px',
          borderWidth: '1.5px',
        },
        '&.Mui-focused': {
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: '2.5px',
            borderColor: '#2e2e2e',
          },
        },
        '& .MuiInputLabel-outlined': {
          color: '#2e2e2e',
          '&.Mui-focused': {},
        },
      },
    }}
  />
)

export default ParkingSpaces
