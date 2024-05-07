import { DataGrid, gridClasses } from '@mui/x-data-grid'
import { styled } from '@mui/material'

export const DataGridTable = styled(DataGrid)(({ theme }) => ({
  [`& .${gridClasses.row}.odd`]: {
    backgroundColor: theme.palette.grey[200],
  },
}))
