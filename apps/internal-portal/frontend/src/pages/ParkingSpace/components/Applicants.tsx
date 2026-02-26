import { Box, Chip, Stack, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { ApplicantStatus, LeaseStatus } from '@onecore/types'

import { DataGridTable } from '../../../components'
import { useParkingSpaceListing } from '../hooks/useParkingSpaceListing'
import { ApplicantActions } from './ApplicantActions'

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
    parkingSpaceListing?.rentalObject.address ?? ''
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
  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  return [
    {
      field: 'name',
      headerName: 'Namn',
      ...sharedProps,
      flex: 1.25,
      renderCell: (params) => (
        <Box style={{ display: 'flex', flexDirection: 'column' }}>
          <Box>{params.row.name}</Box>{' '}
          <Box>{params.row.nationalRegistrationNumber}</Box>
        </Box>
      ),
    },
    {
      field: 'contactCode',
      headerName: 'Kundnummer',
      ...sharedProps,
      flex: 1,
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
      headerName: 'Har bilplats (G/K)',
      valueFormatter: (v) =>
        v.value.filter(
          (l: any) =>
            l.status == LeaseStatus.Current || l.status == LeaseStatus.Upcoming
        ).length
          ? 'Ja'
          : 'Nej',
      ...sharedProps,
      flex: 1,
    },
    {
      field: 'status',
      headerName: 'Status sökande',
      ...sharedProps,
      flex: 1.25,
      valueFormatter: (v) => formatApplicantStatus(v.value),
      renderCell: (v) => <Chip label={v.formattedValue} />,
    },
    {
      field: 'statusResponse',
      headerName: 'Svar erbjudande',
      renderCell: (v) => formatApplicantStatusResponse(v.row.status),
      ...sharedProps,
    },
    {
      field: 'applicationType',
      headerName: 'Ärende',
      renderCell: (v) => {
        const hasParkingSpace = Boolean(
          v.row.parkingSpaceContracts?.filter(
            (l: any) =>
              l.status == LeaseStatus.Current ||
              l.status == LeaseStatus.Upcoming
          ).length
        )
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
      align: 'center',
      renderCell: (v) => {
        if (v.row.status !== ApplicantStatus.Active) {
          return null
        }

        return (
          <ApplicantActions
            disabled={v.row.status !== ApplicantStatus.Active}
            listingId={listingId}
            applicantId={v.row.id}
            applicantName={v.row.name ?? v.row.contactCode}
            listingAddress={address}
          />
        )
      },
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
  [ApplicantStatus.OfferExpired]: 'Erbjudande utgånget',
  [ApplicantStatus.Disqualified]: 'Ej kvalificerad',
}

const formatApplicantStatus = (v: ApplicantStatus) =>
  applicantStatusFormatMap[v]

const applicantStatusResponseMap: Record<ApplicantStatus, string> = {
  [ApplicantStatus.Active]: '',
  [ApplicantStatus.Assigned]: '',
  [ApplicantStatus.AssignedToOther]: '',
  [ApplicantStatus.WithdrawnByUser]: '',
  [ApplicantStatus.WithdrawnByManager]: '',
  [ApplicantStatus.Offered]: 'Inväntar svar',
  [ApplicantStatus.OfferAccepted]: 'Ja',
  [ApplicantStatus.OfferDeclined]: 'Nej',
  [ApplicantStatus.OfferExpired]: 'Utgånget',
  [ApplicantStatus.Disqualified]: '',
}
const formatApplicantStatusResponse = (v: ApplicantStatus) =>
  applicantStatusResponseMap[v] || ''

const leaseStatusFormatMap: Record<LeaseStatus, string> = {
  [LeaseStatus.Current]: 'Gällande',
  [LeaseStatus.Upcoming]: 'Kommande',
  [LeaseStatus.AboutToEnd]: 'Uppsagt',
  [LeaseStatus.Ended]: 'Upphört',
}

const formatLeaseStatus = (v: LeaseStatus) => leaseStatusFormatMap[v]
