import { DataGrid, gridClasses } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { Stack, Typography, styled } from '@mui/material'

type Props = {
  rows: any[]
  columns: GridColDef[]
  getRowId: any
  loading?: boolean
  emptyLabel: string
}

const StripedDataGrid = styled(DataGrid)(({ theme }) => ({
  [`& .${gridClasses.row}.odd`]: {
    backgroundColor: theme.palette.grey[200],
  },
}))

export const DataGridTable = (props: Props) => (
  <StripedDataGrid
    loading={Boolean(props.loading)}
    rowHeight={65}
    rows={props.rows}
    columns={props.columns}
    getRowId={props.getRowId}
    disableRowSelectionOnClick
    hideFooter
    autoHeight
    getRowClassName={(params) =>
      params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
    }
    slots={{
      noRowsOverlay: () => (
        <Stack paddingTop="1rem" alignItems="center" justifyContent="center">
          <Typography fontSize="14px">{props.emptyLabel}</Typography>
        </Stack>
      ),
    }}
  />
)
