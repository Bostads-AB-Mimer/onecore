import { DataGrid, gridClasses } from '@mui/x-data-grid'
import { styled, Theme } from '@mui/material'
import React from 'react'

export const DataGridTable = styled(DataGrid)(({ theme: _theme }) => ({
  [`& .${gridClasses.main}`]: {
    boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
  },
  [`& .${gridClasses.row} .${gridClasses.withBorderColor}`]: {
    borderBottom: '1.5px solid rgba(0, 0, 0, 0.12)',
  },
  [`& .${gridClasses.columnHeader}.${gridClasses.withBorderColor}`]: {
    border: 'none',
  },
  [`& .${gridClasses.columnHeaders}.${gridClasses.withBorderColor}`]: {
    borderBottom: '1.5px solid rgba(0, 0, 0, 0.12)',
  },
  [`& .${gridClasses.footerContainer}`]: {
    border: 'none',
  },
})) as typeof DataGrid
