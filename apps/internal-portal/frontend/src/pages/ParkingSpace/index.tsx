import { Box, Chip, Divider, Typography } from '@mui/material'
import type { GridColDef, GridValueFormatterParams } from '@mui/x-data-grid'
import { useParams } from 'react-router-dom'
import { Applicant, ApplicantStatus } from 'onecore-types'

import { useParkingSpaceListing } from './hooks/useParkingSpaceListing'
import { PageGoBackTo, DataGridTable } from '../../components'
import { RemoveApplicantFromListing } from './components'

const ParkingSpace = () => {
  const dateFormatter = new Intl.DateTimeFormat('sv-SE')
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })
  const routeParams = useParams<'id'>()
  const { data: parkingSpaceListing } = useParkingSpaceListing({
    id: routeParams.id ?? '',
  })

  const sharedProps = {
    cellClassName: '',
    editable: false,
    flex: 1,
    headerClassName: 'font-bison-bold text-lg text-fuscous-gray',
  }

  const columns: GridColDef<Applicant>[] = [
    {
      field: 'name',
      headerName: 'Namn',
      ...sharedProps,
      flex: 1.25,
    },
    {
      field: 'foo',
      headerName: 'Köpoäng',
      renderCell: () => <i>N/A</i>,
      ...sharedProps,
      flex: 0.75,
    },
    {
      field: 'address',
      headerName: 'Boende/Adress',
      renderCell: () => <i>N/A</i>,
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
      valueFormatter: (v: GridValueFormatterParams<string>) =>
        dateFormatter.format(new Date(v.value)),
    },
    {
      field: 'bar',
      headerName: 'Har bilplats',
      valueFormatter: (v) => (v.value ? 'N/A' : 'N/A'),
      renderCell: () => <i>N/A</i>,
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
          listingId={routeParams.id ?? ''}
          applicantId={v.row.id}
          applicantName={v.row.name}
          listingAddress={parkingSpaceListing.address}
        />
      ),
    },
  ]

  return (
    <>
      <PageGoBackTo to="/parkingspaces" text="Översikt Intresseanmälningar" />
      <Typography paddingBottom="2rem" variant="h1">
        Intresseanmälningar {parkingSpaceListing.address}
      </Typography>
      <DataGridTable
        columns={columns}
        rows={parkingSpaceListing.applicants ?? []}
        getRowId={(row: any) => row.id}
      />
      <Divider
        sx={{
          borderBottomWidth: '1.85px',
          borderColor: 'black',
          paddingTop: '4rem',
        }}
      />
      <Typography paddingY="2rem" variant="h1">
        Objektsinformation
      </Typography>
      <Box display="flex" justifyContent="space-between" gap="4rem">
        <Box flex="0.5" paddingX="1rem">
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Bilplats</Typography>
            <Box>
              <Typography fontWeight="bold">
                {parkingSpaceListing.address}
              </Typography>
              <Typography fontWeight="bold" textAlign="right">
                {parkingSpaceListing.rentalObjectCode}
              </Typography>
            </Box>
          </Box>
          <Box height="50px" />
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Skyltnummer</Typography>
            <Box>
              <Typography fontWeight="bold">{'N/A'}</Typography>
            </Box>
          </Box>
          <Box height="50px" />
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Område</Typography>
            <Box>
              <Typography fontWeight="bold">
                {parkingSpaceListing.districtCaption}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Bilplatstyp</Typography>
            <Box>
              <Typography fontWeight="bold">
                {parkingSpaceListing.objectTypeCaption}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Hyra</Typography>
            <Box>
              <Typography fontWeight="bold">{`${numberFormatter.format(
                parkingSpaceListing.monthlyRent
              )}/mån`}</Typography>
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Sökande</Typography>
            <Box>
              <Typography fontWeight="bold">
                {parkingSpaceListing.applicants?.length ?? 0}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Datum tilldelas</Typography>
            <Box>
              <Typography fontWeight="bold">
                {dateFormatter.format(
                  new Date(parkingSpaceListing.publishedTo)
                )}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" flex="1">
            <Typography>Ledig från och med</Typography>
            <Box>
              <Typography fontWeight="bold">
                {dateFormatter.format(new Date(parkingSpaceListing.vacantFrom))}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box border="1px solid black" flex="1" />
      </Box>
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

export default ParkingSpace
