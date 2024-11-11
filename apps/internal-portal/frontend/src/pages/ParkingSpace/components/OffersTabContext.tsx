import { Box, Chip, Typography } from '@mui/material'
import { useState } from 'react'
import { TabContext, TabPanel } from '@mui/lab'
import {
  Listing,
  Offer,
  OfferStatus,
  OfferWithOfferApplicants,
} from 'onecore-types'

import { OfferRound } from './OfferRound'
import { Tab, Tabs } from '../../../components'

const OffersTabContext = (props: {
  listing: Listing
  offers: OfferWithOfferApplicants[]
}) => {
  const [selectedTab, setSelectedTab] = useState(() => {
    if (props.offers && props.offers.length > 0) {
      return String(props.offers[props.offers.length - 1].id)
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
          <span>Intresseanmälningar {props.listing.address}</span>
        </Typography>
        <Chip
          label={formatStatus(props.offers)}
          sx={{ marginY: 'auto' }}
        ></Chip>
      </Box>
      <Tabs onChange={handleChange}>
        {props.offers.map((offer, i) => (
          <Tab
            key={offer.id}
            disableRipple
            label={`Omgång ${i + 1}`}
            value={String(offer.id)}
          />
        ))}
      </Tabs>
      <Box paddingTop="1rem">
        {props.offers.map((offer, i) => (
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

const offerFormatMap: Record<OfferStatus, string> = {
  [OfferStatus.Active]: 'Erbjudande',
  [OfferStatus.Accepted]: 'Tilldelad / kontrakterad',
  [OfferStatus.Declined]: 'Nekad',
  [OfferStatus.Expired]: 'Utgången',
}

const formatStatus = (offers: Offer[]) => {
  return offerFormatMap[offers[offers.length - 1].status]
}

export default OffersTabContext
