import { Typography, Grid } from '@mui/material'
import { Suspense } from 'react'
import { useParams } from 'react-router-dom'

import {
  ApplicantsLoading,
  ParkingSpaceInfo,
  ParkingSpaceInfoLoading,
} from './components'
import { useParkingSpaceListing } from './hooks/useParkingSpaceListing'
import CommentSection from './components/CommentSection'
import OffersTabContext from './components/OffersTabContext'
import AllApplicantsTabContext from './components/AllApplicantsTabContext'
import { PageGoBack } from '../../components/PageGoBack'

const ParkingSpace = () => {
  const routeParams = useParams<'id'>()
  if (!routeParams.id) return null
  const listingId = Number.parseInt(routeParams.id)

  return (
    <>
      <PageGoBack text="Översikt lediga bilplatser" />
      <Suspense fallback={<ApplicantsLoading />}>
        <ParkingSpaceTabs listingId={listingId} />
      </Suspense>
      <Grid container columnSpacing={4}>
        <Grid item xl={6}>
          <Typography paddingY="2rem" variant="h1">
            Objektsinformation
          </Typography>
          <Suspense fallback={<ParkingSpaceInfoLoading />}>
            <ParkingSpaceInfo listingId={listingId} />
          </Suspense>
        </Grid>
        <Grid item xs={6}>
          <Typography paddingY="2rem" variant="h1">
            Kommentarer / Logg
          </Typography>
          <CommentSection
            threadId={{ targetType: 'listing', targetId: listingId }}
          />
        </Grid>
      </Grid>
    </>
  )
}

const ParkingSpaceTabs = (props: { listingId: number }) => {
  const { data } = useParkingSpaceListing({
    id: props.listingId,
  })

  // Don't render tabs for NON_SCORED rental rules
  if (data.rentalRule === 'NON_SCORED') {
    return null
  }

  return (
    <>
      {!data.offers.length ? (
        <AllApplicantsTabContext listing={data} />
      ) : (
        <OffersTabContext listing={data} offers={data.offers} />
      )}
    </>
  )
}

export default ParkingSpace
