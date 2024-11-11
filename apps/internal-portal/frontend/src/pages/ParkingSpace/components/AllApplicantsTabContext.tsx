import { Box, Chip, Typography } from '@mui/material'
import { TabContext, TabPanel } from '@mui/lab'
import { Listing, ListingStatus } from 'onecore-types'

import { Tab, Tabs } from '../../../components'
import { Applicants } from './Applicants'

const AllApplicantsTabContext = (props: { listing: Listing }) => {
  return (
    <TabContext value={'1'}>
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
          label={formatStatus(props.listing.status)}
          sx={{ marginY: 'auto' }}
        ></Chip>
      </Box>
      <Tabs>
        <Tab disableRipple label="Alla sökande" value="1" />
      </Tabs>
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
  [ListingStatus.NoApplicants]: 'Inga sökande',
  [ListingStatus.Expired]: 'Klar för erbjudande',
}

const formatStatus = (listingStatus: ListingStatus) => {
  return listingFormatMap[listingStatus]
}

export default AllApplicantsTabContext
