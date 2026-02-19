import { Typography, Stack } from '@mui/material'
import { GridColDef } from '@mui/x-data-grid'
import { Lease } from '@onecore/types'
import { TabPanel } from '@mui/lab'

import { DataGridTable, Tab } from '../../../../components'

export interface Props {
  leases: Lease[]
}

export const Contracts = (props: Props) => {
  return (
    <>
      <Tab
        label={`Kontrakt (${props.leases.length})`}
        value="2"
        disableRipple
      />
      <TabPanel value="2" sx={{ padding: 0 }}>
        <Leases leases={props.leases} />
      </TabPanel>
    </>
  )
}

const sharedProps = {
  editable: false,
  flex: 1,
}

const columns: GridColDef[] = [
  {
    field: 'type',
    headerName: 'Typ',
    ...sharedProps,
  },
  {
    field: 'status',
    headerName: 'Status',
    ...sharedProps,
    renderCell: () => 'N/A',
  },
  {
    field: 'address',
    headerName: 'Adress',
    ...sharedProps,
    renderCell: () => 'N/A',
  },
  {
    field: 'rent.amount',
    headerName: 'Hyra',
    ...sharedProps,
    renderCell: () => 'N/A',
  },
]

const Leases = (props: { leases: Lease[] }) => (
  <DataGridTable
    sx={{ paddingTop: '1rem' }}
    initialState={{
      pagination: { paginationModel: { pageSize: 5 } },
    }}
    slots={{
      noRowsOverlay: () => (
        <Stack paddingTop="1rem" alignItems="center" justifyContent="center">
          <Typography fontSize="14px">
            Det finns inga kontrakt att visa...
          </Typography>
        </Stack>
      ),
    }}
    hideFooter
    columns={columns}
    rows={props.leases}
    getRowId={(row) => row.leaseId}
    loading={false}
    rowHeight={72}
    disableRowSelectionOnClick
    autoHeight
  />
)
