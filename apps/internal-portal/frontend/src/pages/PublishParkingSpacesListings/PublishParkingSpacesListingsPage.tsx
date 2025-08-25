import { useEffect, useState } from 'react'
import { Box, Button, MenuItem, Select, Stack, Typography } from '@mui/material'
import { type GridRowId, type GridColDef } from '@mui/x-data-grid'
import { RentalObject } from '@onecore/types'

import { DataGridTable } from '../../components'
import { ListingWithOffer } from '../ParkingSpaces/hooks/useParkingSpaceListings'
import { useVacantParkingSpaces } from '../ParkingSpaces/hooks/useVacantParkingSpaces'

const getColumns = (): Array<GridColDef<RentalObject>> => {
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  return [
    {
      field: 'address',
      headerName: 'Bilplats',
      flex: 1.25,
      renderCell: ({ row }) => (
        <span>
          <span style={{ display: 'block' }}>{row.address}</span>
          {row.rentalObjectCode}
        </span>
      ),
    },
    {
      field: 'residentialAreaCaption',
      flex: 1,
      headerName: 'Område',
    },
    {
      field: 'districtCaption',
      flex: 1,
      headerName: 'Distrikt',
    },
    {
      field: 'objectTypeCaption',
      flex: 1,
      headerName: 'Bilplatstyp',
    },
    {
      field: 'monthlyRent',
      flex: 1,
      headerName: 'Hyra',
      valueFormatter: ({ value }) => `${numberFormatter.format(value)}/mån`,
    },
    {
      field: 'numTimesPublishedInInternalQueue',
      flex: 1,
      headerName: 'Antal publiceringar intern kö',
    },
  ]
}

const getActionColumns = (): Array<GridColDef<ListingWithOffer>> => {
  return [
    {
      field: 'actions',
      type: 'actions',
      flex: 1,
      minWidth: 250,
      headerName: 'Publicera i kötyp',
      headerAlign: 'left',
      renderCell: () => (
        // TODO: Rule-based selection of queue type depending on whether it has
        // been published before and which area it belongs to. If the parking
        // space is in an area with special rental rules, it defaults to the
        // `internal` queue.
        //
        // (Same as for the number of parking spaces per applicant)
        <Select defaultValue="SCORED" fullWidth>
          <MenuItem value="SCORED">Intern</MenuItem>
          <MenuItem value="NON_SCORED">Poängfri</MenuItem>
        </Select>
      ),
    },
  ]
}

const ParkingSpaces = ({
  columns,
  rows = [],
  loading,
  selectedIds,
  onRowSelectionModelChange,
}: {
  columns: Array<GridColDef>
  rows?: Array<RentalObject>
  loading: boolean
  selectedIds: Array<GridRowId>
  onRowSelectionModelChange: (model: Array<GridRowId>) => void
}) => (
  <DataGridTable
    slots={{
      noRowsOverlay: () => (
        <Stack paddingTop="1rem" alignItems="center" justifyContent="center">
          <Typography fontSize="14px">
            Det finns inga annonser att visa.
          </Typography>
        </Stack>
      ),
    }}
    columns={columns}
    getRowId={(row) => row.rentalObjectCode}
    rows={rows}
    loading={loading}
    rowHeight={72}
    checkboxSelection
    autoHeight
    hideFooterPagination={false}
    rowSelectionModel={selectedIds}
    onRowSelectionModelChange={onRowSelectionModelChange}
  />
)

const handlePublishParkingSpaces = (ids: Array<GridRowId>) => {
  console.log('Publishing parking spaces with IDs:', ids)
}

const PublishParkingSpacesPage: React.FC = () => {
  const { data: parkingSpaces, isLoading } = useVacantParkingSpaces()
  const [selectedIds, setSelectedIds] = useState<Array<GridRowId>>([])

  useEffect(() => {
    if (parkingSpaces) {
      setSelectedIds(
        parkingSpaces.map(({ rentalObjectCode }) => rentalObjectCode)
      )
    }
  }, [parkingSpaces])

  return (
    <Box>
      <Typography variant="h1" paddingBottom={2}>
        Publicera bilplatser
      </Typography>

      <Typography variant="body1" paddingBottom={2}>
        Nedan listas alla bilplatser som behöver ompubliceras från Xpand och som
        ej är spärrade.
      </Typography>

      <ParkingSpaces
        key="needs-republish"
        rows={parkingSpaces}
        columns={[...getColumns(), ...getActionColumns()]}
        loading={isLoading}
        selectedIds={selectedIds}
        onRowSelectionModelChange={setSelectedIds}
      />

      <Box display="flex" justifyContent="space-between">
        <Button variant="dark-outlined" onClick={() => window.history.back()}>
          Tillbaka
        </Button>

        <Button
          variant="contained"
          onClick={() => handlePublishParkingSpaces(selectedIds)}
        >
          Publicera bilplatser
        </Button>
      </Box>
    </Box>
  )
}

export default PublishParkingSpacesPage
