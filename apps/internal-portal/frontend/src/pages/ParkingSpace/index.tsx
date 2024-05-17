import { Typography } from '@mui/material'
import { Suspense } from 'react'
import { useParams } from 'react-router-dom'

import { PageGoBackTo } from '../../components'
import {
  Applicants,
  ApplicantsLoading,
  ParkingSpaceInfo,
  ParkingSpaceInfoLoading,
} from './components'

const ParkingSpace = () => {
  const routeParams = useParams<'id'>()

  return (
    <>
      <PageGoBackTo to="/parkingspaces" text="Översikt lediga bilplatser" />
      <Suspense fallback={<ApplicantsLoading />}>
        <Applicants listingId={routeParams.id ?? ''} />
      </Suspense>
      <Typography paddingY="2rem" variant="h1">
        Objektsinformation
      </Typography>
      <Suspense fallback={<ParkingSpaceInfoLoading />}>
        <ParkingSpaceInfo listingId={routeParams.id ?? ''} />
      </Suspense>
    </>
  )
}

export default ParkingSpace
