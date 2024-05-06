import { Box, IconButton, TextField, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import type { GridColDef } from '@mui/x-data-grid'
import Chevron from '@mui/icons-material/ChevronRight'
import { Link } from 'react-router-dom'
import { Listing } from 'onecore-types'

import { DataGridTable } from '../../components'
import { useParkingSpaces } from './hooks/useParkingSpaces'
import * as utils from '../../utils'

const sharedProps = {
  editable: false,
  flex: 1,
  headerClassName: 'font-bison-bold text-lg text-fuscous-gray',
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
      headerName: 'Datum tilldelas',
      ...sharedProps,
      valueFormatter: (v) => dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'vacantFrom',
      headerName: 'Ledig från och med',
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
          <IconButton>
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
        <Typography variant="h1">
          Intresseanmälningar Parkeringsplats
        </Typography>
        <SearchApplicant
          onChange={onSearch}
          disabled={parkingSpaces.isLoading}
          placeholder="Sök kundnummer"
        />
      </Box>
      {parkingSpaces.error && 'Error'}
      <DataGridTable
        emptyLabel="Det finns inga annonser att visa..."
        columns={columns}
        rows={filterListings(parkingSpaces.data ?? [], searchString)}
        getRowId={(row: Listing) => row.id}
        loading={parkingSpaces.status === 'pending'}
      />
    </>
  )
}

const filterListings = (
  listings: Array<Listing>,
  q?: string
): Array<Listing> => {
  if (!q) return listings
  return listings.filter((l) =>
    l.applicants?.some((a) =>
      a.contactCode.toLowerCase().includes(q.toLowerCase())
    )
  )
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
          borderColor: '#2e2e2e',
          borderRadius: '8px',
          borderWidth: '2.5px',
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
