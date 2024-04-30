import { IconButton, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import Chevron from '@mui/icons-material/ChevronRight'
import { Link } from 'react-router-dom'
import { Listing } from 'onecore-types'

import { DataGridTable } from '../../components'
import { useParkingSpaces } from './hooks/useParkingSpaces'

const ParkingSpaces = () => {
  const parkingSpaces = useParkingSpaces()
  const dateFormatter = new Intl.DateTimeFormat('sv-SE')
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  const sharedProps = {
    cellClassName: '',
    editable: false,
    flex: 1,
    headerClassName: 'font-bison-bold text-lg text-fuscous-gray',
  }

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

  return (
    <>
      <Typography paddingBottom="2rem" variant="h1">
        Intresseanmälningar Parkeringsplats
      </Typography>
      {parkingSpaces.error && 'Error'}
      <DataGridTable
        columns={columns}
        rows={parkingSpaces.data ?? []}
        getRowId={(row: Listing) => row.id}
        loading={parkingSpaces.status === 'pending'}
      />
    </>
  )
}

export default ParkingSpaces
