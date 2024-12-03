import { Typography } from '@mui/material'
import { Suspense } from 'react'
import { useParams } from 'react-router-dom'

import {
  ApplicantsLoading,
  ParkingSpaceInfo,
  ParkingSpaceInfoLoading,
} from './components'
import { useParkingSpaceListing } from './hooks/useParkingSpaceListing'
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
      <Typography paddingY="2rem" variant="h1">
        Objektsinformation
      </Typography>
      <Suspense fallback={<ParkingSpaceInfoLoading />}>
        <ParkingSpaceInfo listingId={listingId} />
      </Suspense>
    </>
  )
}

const ParkingSpaceTabs = (props: { listingId: number }) => {
  const { data } = useParkingSpaceListing({
    id: props.listingId,
  })

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
