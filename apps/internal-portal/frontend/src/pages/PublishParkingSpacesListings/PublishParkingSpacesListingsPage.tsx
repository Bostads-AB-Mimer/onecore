import { useEffect, useState, useMemo, memo } from 'react'
import {
  Box,
  Button,
  Stack,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { type GridRowId, type GridColDef } from '@mui/x-data-grid'
import { RentalObject } from '@onecore/types'

import { DataGridTable } from '../../components'
import { useVacantParkingSpaces } from '../ParkingSpaces/hooks/useVacantParkingSpaces'
import { usePublishParkingSpaces } from './hooks/usePublishParkingSpaces'
import { useRentalRules } from './hooks/useRentalRules'
import {
  getParkingSpaceColumns,
  getRentalRuleActionColumn,
} from './utils/columnUtils'

const ParkingSpaces = memo(
  ({
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
)

export const PublishParkingSpacesListingsPage = () => {
  const [selectedIds, setSelectedIds] = useState<GridRowId[]>([])
  const { data: parkingSpaces, isLoading } = useVacantParkingSpaces()

  const { rentalRules, handleRentalRuleChange, initializeRentalRules } =
    useRentalRules()
  const { message, setMessage, handlePublishParkingSpaces, isPending } =
    usePublishParkingSpaces()

  // Memoize columns to prevent unnecessary re-renders
  const columns = useMemo(
    () => [
      ...getParkingSpaceColumns(),
      getRentalRuleActionColumn(rentalRules, handleRentalRuleChange),
    ],
    [rentalRules, handleRentalRuleChange]
  )

  useEffect(() => {
    if (parkingSpaces) {
      setSelectedIds(
        parkingSpaces.map(({ rentalObjectCode }) => rentalObjectCode)
      )
      // Initialize rental rules with default values
      initializeRentalRules(parkingSpaces)
    }
  }, [parkingSpaces, initializeRentalRules])

  return (
    <Box>
      <Typography variant="h1" paddingBottom={2}>
        Publicera bilplatser
      </Typography>

      <Typography variant="body1" paddingBottom={2}>
        Nedan listas alla bilplatser som behöver ompubliceras från Xpand och som
        ej är spärrade.
      </Typography>

      {message && (
        <Alert
          severity={message.severity}
          onClose={() => setMessage(null)}
          sx={{ mb: 2 }}
        >
          {message.text}
        </Alert>
      )}

      <ParkingSpaces
        key="needs-republish"
        rows={parkingSpaces}
        columns={columns}
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
          onClick={() => handlePublishParkingSpaces(selectedIds, rentalRules)}
          disabled={isPending || selectedIds.length === 0}
        >
          {isPending ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Publicerar...
            </>
          ) : (
            'Publicera bilplatser'
          )}
        </Button>
      </Box>
    </Box>
  )
}

export default PublishParkingSpacesListingsPage
