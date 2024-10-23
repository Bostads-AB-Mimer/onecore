import { Box, Chip, Typography } from '@mui/material'
import { Suspense, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabContext, TabPanel } from '@mui/lab'
import { ListingStatus, Offer, OfferStatus } from 'onecore-types'

import { PageGoBackTo, Tab, Tabs } from '../../components'
import {
  Applicants,
  ApplicantsLoading,
  OfferRound,
  ParkingSpaceInfo,
  ParkingSpaceInfoLoading,
} from './components'
import { useParkingSpaceListing } from './hooks/useParkingSpaceListing'

const ParkingSpace = () => {
  const routeParams = useParams<'id'>()
  if (!routeParams.id) return null
  const listingId = Number.parseInt(routeParams.id)

  return (
    <>
      <PageGoBackTo to="/parkingspaces" text="Översikt lediga bilplatser" />
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

  const [selectedTab, setSelectedTab] = useState(() => {
    if (data.status === ListingStatus.Assigned && data.offers.length > 0) {
      return String(data.offers[0].id)
    }
    return '1'
  })

  const handleChange = (_e: React.SyntheticEvent, tab: string) =>
    setSelectedTab(tab)

  return (
    <TabContext value={selectedTab}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <Typography paddingBottom="0.5rem" marginRight="1rem" variant="h1">
          <span>Intresseanmälningar {data.address}</span>
        </Typography>
        <Chip
          label={formatStatus(data.offers, data.status)}
          sx={{ marginY: 'auto' }}
        ></Chip>
      </Box>
      <Tabs onChange={handleChange}>
        {data.status !== ListingStatus.Assigned && (
          <Tab disableRipple label="Alla sökande" value="1" />
        )}
        {data.offers.map((offer, i) => (
          <Tab
            key={offer.id}
            disableRipple
            label={`Omgång ${i + 1}`}
            value={String(offer.id)}
          />
        ))}
      </Tabs>
      <Box paddingTop="1rem">
        <TabPanel value="1" sx={{ padding: 0 }}>
          <Applicants key="foo" listingId={props.listingId} />
        </TabPanel>
        {data.offers.map((offer, i) => (
          <TabPanel key={offer.id} value={String(offer.id)} sx={{ padding: 0 }}>
            <OfferRound
              key={offer.id}
              applicants={offer.selectedApplicants}
              offer={offer}
              numRound={i + 1}
            />
          </TabPanel>
        ))}
      </Box>
    </TabContext>
  )
}

const listingFormatMap: Record<ListingStatus, string> = {
  [ListingStatus.Active]: 'Publicerad',
  [ListingStatus.Assigned]: 'Tilldelad',
  [ListingStatus.Deleted]: 'Borttagen',
  [ListingStatus.Expired]: 'Klar för erbjudande',
}

const offerFormatMap: Record<OfferStatus, string> = {
  [OfferStatus.Active]: 'Erbjudande',
  [OfferStatus.Accepted]: 'Tilldelad / kontrakterad',
  [OfferStatus.Declined]: 'Nekad',
  [OfferStatus.Expired]: 'Utgången',
}

const formatStatus = (offers: Offer[], listingStatus: ListingStatus) => {
  //if offers exists, the latest offer status is the overall status
  if (offers.length > 0) {
    return offerFormatMap[offers[offers.length - 1].status]
  }
  return listingFormatMap[listingStatus]
}

export default ParkingSpace
