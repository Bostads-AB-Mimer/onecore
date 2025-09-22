import { Box, Button, Chip, Typography } from '@mui/material'
import { TabContext, TabPanel } from '@mui/lab'
import { Listing, ListingStatus } from '@onecore/types'

import { Applicants } from './Applicants'
import { useCreateOffer } from '../hooks/useCreateOffer'

const AllApplicantsTabContext = (props: { listing: Listing }) => {
  const createOffer = useCreateOffer()

  const onCreateOffer = () => {
    createOffer.mutate({ listingId: props.listing.id }, {})
  }

  const renderStartOfferProcessButton = (listingStatus: ListingStatus) => {
    if (listingStatus == ListingStatus.Expired) {
      return (
        <Box>
          <Button variant="dark" onClick={() => onCreateOffer()}>
            <Box
              sx={{
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              Starta erbjudandeomgång
            </Box>
          </Button>
        </Box>
      )
    }
  }

  return (
    <TabContext value={'1'}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <Typography paddingBottom="2rem" marginRight="1rem" variant="h1">
          <span>Intresseanmälningar {props.listing.rentalObject.address}</span>
        </Typography>
        <Chip
          label={formatStatus(props.listing.status)}
          sx={{ marginY: 'auto' }}
        ></Chip>
      </Box>
      {renderStartOfferProcessButton(props.listing.status)}
      <Box paddingTop="1rem">
        <TabPanel value="1" sx={{ padding: 0 }}>
          <Applicants key="foo" listingId={props.listing.id} />
        </TabPanel>
      </Box>
    </TabContext>
  )
}

const listingFormatMap: Record<ListingStatus, string> = {
  [ListingStatus.Active]: 'Publicerad',
  [ListingStatus.Assigned]: 'Tilldelad',
  [ListingStatus.Closed]: 'Stängd',
  [ListingStatus.Expired]: 'Klar för erbjudande',
}

const formatStatus = (listingStatus: ListingStatus) => {
  return listingFormatMap[listingStatus]
}

export default AllApplicantsTabContext
