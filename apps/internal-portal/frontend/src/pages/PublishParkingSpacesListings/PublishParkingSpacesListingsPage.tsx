import { useEffect, useState, useMemo, memo, useCallback } from 'react'
import {
  Box,
  Button,
  Stack,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
      // Enable pagination
      initialState={{
        pagination: { paginationModel: { pageSize: 50 } },
      }}
      pageSizeOptions={[50, 100]}
    />
  )
)

export const PublishParkingSpacesListingsPage = () => {
  const [selectedIds, setSelectedIds] = useState<GridRowId[]>([])
  const [showBatchConfirm, setShowBatchConfirm] = useState(false)
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

  // Handle publish with batch size warning
  const handlePublishClick = useCallback(() => {
    if (selectedIds.length > 100) {
      setShowBatchConfirm(true)
    } else {
      handlePublishParkingSpaces(selectedIds, rentalRules)
    }
  }, [selectedIds, rentalRules, handlePublishParkingSpaces])

  const handleConfirmBatchPublish = useCallback(() => {
    setShowBatchConfirm(false)
    handlePublishParkingSpaces(selectedIds, rentalRules)
  }, [selectedIds, rentalRules, handlePublishParkingSpaces])

  useEffect(() => {
    if (parkingSpaces) {
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

      {/* Selection info */}
      {parkingSpaces && parkingSpaces.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {selectedIds.length} av {parkingSpaces.length} markerade
          </Typography>
        </Box>
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
          onClick={handlePublishClick}
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

      {/* Batch confirmation dialog */}
      <Dialog
        open={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        aria-labelledby="batch-confirmation-title"
      >
        <DialogTitle id="batch-confirmation-title">
          Stor batch detekterad
        </DialogTitle>
        <DialogContent>
          Du är på väg att publicera {selectedIds.length} parkeringsplatser.
          Detta kommer att delas upp i batchar för att undvika överlastning av
          systemet. Vill du fortsätta?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBatchConfirm(false)}>Avbryt</Button>
          <Button onClick={handleConfirmBatchPublish} variant="contained">
            Fortsätt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default PublishParkingSpacesListingsPage
