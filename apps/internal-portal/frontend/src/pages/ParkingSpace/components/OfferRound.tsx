import { Box, Chip } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { ApplicantStatus, LeaseStatus, OfferApplicant } from 'onecore-types'

import { DataGridTable } from '../../../components'

export const OfferRound = (props: {
  numRound: number
  applicants: Array<OfferApplicant>
}) => {
  return (
    <>
      <DataGridTable
        columns={columns as any}
        rows={props.applicants}
        getRowId={(row) => row.id}
        initialState={{
          pagination: { paginationModel: { pageSize: 5 } },
        }}
        pageSizeOptions={[5, 10, 25]}
        rowHeight={72}
        disableRowSelectionOnClick
        autoHeight
      />
    </>
  )
}

const sharedProps = {
  editable: false,
  flex: 1,
}

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
const columns: GridColDef[] = [
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
    valueGetter: (v) => v.row.address,
    ...sharedProps,
    flex: 1.25,
  },
  {
    field: 'housingLeaseStatus',
    headerName: 'Status Boendekontrakt',
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
    field: 'hasParkingSpace',
    headerName: 'Har bilplats',
    valueFormatter: (v) => (v.value ? 'Ja' : 'Nej'),
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
      if (v.value === 'Additional')
        return v.row.hasParkingSpace ? 'Hyra flera' : 'Hyra en'
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
]

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
  [LeaseStatus.Current]: 'Aktivt',
  [LeaseStatus.Ended]: 'Avslutat',
  [LeaseStatus.AboutToEnd]: 'Avslutande',
  [LeaseStatus.Upcoming]: 'Kommande',
}

const formatLeaseStatus = (v: LeaseStatus) => leaseStatusFormatMap[v]
