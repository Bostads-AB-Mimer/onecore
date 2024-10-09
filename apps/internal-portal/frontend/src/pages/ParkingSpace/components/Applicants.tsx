import { Chip, Stack, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { ApplicantStatus, LeaseStatus } from 'onecore-types'

import { DataGridTable } from '../../../components'
import { useParkingSpaceListing } from '../hooks/useParkingSpaceListing'
import { RemoveApplicantFromListing } from './RemoveApplicantFromListing'

const sharedProps = {
  editable: false,
  flex: 1,
}

export const Applicants = (props: { listingId: number }) => {
  const { data: parkingSpaceListing } = useParkingSpaceListing({
    id: props.listingId,
  })

  const columns = getColumns(
    props.listingId,
    parkingSpaceListing?.address ?? ''
  )

  return (
    <>
      <DataGridTable
        columns={columns}
        rows={parkingSpaceListing.applicants}
        getRowId={(row) => row.id}
        initialState={{
          pagination: { paginationModel: { pageSize: 5 } },
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
        pageSizeOptions={[5, 10, 25]}
        rowHeight={72}
        disableRowSelectionOnClick
        autoHeight
      />
    </>
  )
}

const getColumns = (listingId: number, address: string): Array<GridColDef> => {
  const dateFormatter = new Intl.DateTimeFormat('sv-SE')
  return [
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
      headerName: 'Boendeadress',
      valueGetter: (v) => v.row.address.street,
      ...sharedProps,
      flex: 1.25,
    },
    {
      ...sharedProps,
      field: 'upcomingHousingContract',
      headerName: 'Status Boendekontrakt',
      valueGetter: (v) => {
        if (v.row.upcomingHousingContract)
          return v.row.upcomingHousingContract.status
        else if (v.row.currentHousingContract)
          return v.row.currentHousingContract.status
      },
      valueFormatter: (v) => formatLeaseStatus(v.value),
      renderCell: (v) => <Chip label={v.formattedValue} />,
      ...sharedProps,
      flex: 1,
    },
    {
      field: 'applicationDate',
      headerName: 'Anmälan',
      ...sharedProps,
      valueFormatter: (v) => dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'parkingSpaceContracts',
      headerName: 'Har bilplats',
      valueFormatter: (v) => (v.value.length ? 'Ja' : 'Nej'),
      ...sharedProps,
      flex: 0.75,
    },
    {
      field: 'status',
      headerName: 'Status ansökan',
      ...sharedProps,
      flex: 1.25,
      valueFormatter: (v) => formatApplicantStatus(v.value),
      renderCell: (v) => <Chip label={v.formattedValue} />,
    },
    {
      field: 'foo',
      headerName: 'Svar erbj.',
      renderCell: (v) => v.value || <i>N/A</i>,
      ...sharedProps,
    },
    {
      field: 'applicationType',
      headerName: 'Ärende',
      renderCell: (v) => {
        const hasParkingSpace = Boolean(v.row.parkingSpaceContracts?.length)
        if (v.value === 'Additional')
          return hasParkingSpace ? 'Hyra flera' : 'Hyra en'
        else return 'Byte'
      },
      ...sharedProps,
    },
    {
      field: 'priority',
      headerName: 'Prioritetsgrupp',
      ...sharedProps,
      valueFormatter: (v) => formatApplicantStatus(v.value),
      renderCell: (v) => v.value ?? <i>N/A</i>,
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
          listingId={listingId}
          applicantId={v.row.id}
          applicantName={v.row.name}
          listingAddress={address}
        />
      ),
    },
  ]
}
const applicantStatusFormatMap: Record<ApplicantStatus, string> = {
  [ApplicantStatus.Active]: 'Aktiv',
  [ApplicantStatus.Assigned]: 'Tilldelad',
  [ApplicantStatus.AssignedToOther]: 'Tilldelad annan',
  [ApplicantStatus.WithdrawnByUser]: 'Borttagen av användare',
  [ApplicantStatus.WithdrawnByManager]: 'Borttagen av medarbetare',
  [ApplicantStatus.Offered]: 'Erbjuden plats',
  [ApplicantStatus.OfferAccepted]: 'Erbjudande accepterat',
  [ApplicantStatus.OfferDeclined]: 'Erbjudande nekat',
}

const formatApplicantStatus = (v: ApplicantStatus) =>
  applicantStatusFormatMap[v]

const leaseStatusFormatMap: Record<LeaseStatus, string> = {
  [LeaseStatus.Current]: 'Gällande',
  [LeaseStatus.Upcoming]: 'Kommande',
  [LeaseStatus.AboutToEnd]: 'Uppsagt',
  [LeaseStatus.Ended]: 'Upphört',
}

const formatLeaseStatus = (v: LeaseStatus) => leaseStatusFormatMap[v]
