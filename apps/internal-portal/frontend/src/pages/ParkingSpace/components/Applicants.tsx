import { Chip, Stack, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { ApplicantStatus } from 'onecore-types'

import { DataGridTable } from '../../../components'
import { useParkingSpaceListing } from '../hooks/useParkingSpaceListing'
import { RemoveApplicantFromListing } from './RemoveApplicantFromListing'

export const Applicants = (props: { listingId: string }) => {
  const { data: parkingSpaceListing } = useParkingSpaceListing({
    id: props.listingId,
  })

  const dateFormatter = new Intl.DateTimeFormat('sv-SE')

  const sharedProps = {
    editable: false,
    flex: 1,
    headerClassName: 'font-bison-bold text-lg text-fuscous-gray',
  }

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Namn',
      ...sharedProps,
      flex: 1.25,
    },
    {
      field: 'queuePoints',
      headerName: 'Köpoäng',
      ...sharedProps,
      flex: 0.75,
    },
    {
      field: 'address',
      headerName: 'Boende/Adress',
      valueGetter: (v) => v.row.address.street,
      ...sharedProps,
      flex: 1.25,
    },
    {
      field: 'status',
      headerName: 'Status',
      ...sharedProps,
      flex: 1.25,
      valueFormatter: (v) => formatApplicantStatus(v.value),
      renderCell: (v) => <Chip label={v.formattedValue} />,
    },
    {
      field: 'applicationDate',
      headerName: 'Anmälan',
      ...sharedProps,
      valueFormatter: (v) => dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'currentHousingContract',
      headerName: 'Har bilplats',
      valueFormatter: (v) => (v.value ? 'Ja' : 'Nej'),
      ...sharedProps,
      flex: 0.75,
    },
    {
      field: 'applicationType',
      headerName: 'Ärende',
      renderCell: (v) => v.value || <i>N/A</i>,
      ...sharedProps,
    },
    {
      field: 'action',
      headerName: '',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (v) => (
        <RemoveApplicantFromListing
          disabled={v.row.status !== ApplicantStatus.Active}
          listingId={props.listingId}
          applicantId={v.row.id}
          applicantName={v.row.name}
          listingAddress={parkingSpaceListing.address}
        />
      ),
    },
  ]

  return (
    <>
      <Typography paddingBottom="2rem" variant="h1">
        Intresseanmälningar {parkingSpaceListing.address}
      </Typography>
      <DataGridTable
        columns={columns}
        rows={parkingSpaceListing.applicants}
        getRowId={(row) => row.id}
        getRowClassName={(params) =>
          params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
        }
        initialState={{
          sorting: {
            sortModel: [{ field: 'queuePoints', sort: 'desc' }],
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <Stack
              paddingTop="1rem"
              alignItems="center"
              justifyContent="center"
            >
              <Typography fontSize="14px">
                Det finns inga sökande att visa...
              </Typography>
            </Stack>
          ),
        }}
        rowHeight={65}
        disableRowSelectionOnClick
        autoHeight
        hideFooter
      />
    </>
  )
}

const applicantStatusFormatMap: Record<ApplicantStatus, string> = {
  [ApplicantStatus.Active]: 'Aktiv',
  [ApplicantStatus.Assigned]: 'Tilldelad',
  [ApplicantStatus.AssignedToOther]: 'Tilldelad annan',
  [ApplicantStatus.WithdrawnByUser]: 'Borttagen av användare',
  [ApplicantStatus.WithdrawnByManager]: 'Borttagen av medarbetare',
}

const formatApplicantStatus = (v: ApplicantStatus) =>
  applicantStatusFormatMap[v]
