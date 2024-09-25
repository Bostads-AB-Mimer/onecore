import { Chip } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { ApplicantStatus, DetailedApplicant } from 'onecore-types'

import { DataGridTable } from '../../../components'

export const OfferRound = (props: {
  numRound: number
  applicants: Array<DetailedApplicant>
}) => {
  return (
    <>
      <DataGridTable
        columns={columns}
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

const dateFormatter = new Intl.DateTimeFormat('sv-SE')
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
    field: 'parkingSpaceContracts',
    headerName: 'Har bilplats',
    valueFormatter: (v) => (v.value.length ? 'Ja' : 'Nej'),
    ...sharedProps,
    flex: 0.75,
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
