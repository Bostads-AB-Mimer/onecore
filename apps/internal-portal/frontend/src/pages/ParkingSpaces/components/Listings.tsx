import { GridColDef } from '@mui/x-data-grid'
import { Listing } from '@onecore/types'
import { DataGridTable } from '../../../components'
import { Stack, Typography } from '@mui/material'

export const Listings = (props: {
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
