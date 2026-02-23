import { Box, Typography } from '@mui/material'
import { Listing } from '@onecore/types'

import { printVacantFrom } from '../../../../common/formattingUtils'

export const ListingInfo = (props: { listing: Listing }) => {
  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  return (
    <Box>
      <Box
        paddingTop="1rem"
        display="flex"
        justifyContent="space-between"
        flex="1"
      >
        <Typography>Område</Typography>
        <Box>
          <Typography>{props.listing.rentalObject.districtCaption}</Typography>
        </Box>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flex="1"
        paddingTop="0.5rem"
      >
        <Typography>Objektsid</Typography>
        <Box>
          <Typography>{props.listing.rentalObjectCode}</Typography>
        </Box>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flex="1"
        paddingTop="0.5rem"
      >
        <Typography>Bilplatstyp</Typography>
        <Box>
          <Typography>
            {props.listing.rentalObject.objectTypeCaption}
          </Typography>
        </Box>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flex="1"
        paddingTop="0.5rem"
      >
        <Typography>Hyra</Typography>
        <Box>
          <Typography>{`${numberFormatter.format(
            props.listing.rentalObject.rent?.amount ?? 0
          )}/mån`}</Typography>
        </Box>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flex="1"
        paddingTop="0.5rem"
      >
        <Typography>Sökande</Typography>
        <Box>
          <Typography>{props.listing.applicants?.length ?? 0}</Typography>
        </Box>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flex="1"
        paddingTop="0.5rem"
      >
        <Typography>Datum tilldelas</Typography>
        <Box>
          <Typography>
            {props.listing.publishedTo
              ? dateFormatter.format(new Date(props.listing.publishedTo))
              : '-'}
          </Typography>
        </Box>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flex="1"
        paddingTop="0.5rem"
      >
        <Typography>Ledig från och med</Typography>
        <Box>
          <Typography>
            {printVacantFrom(
              dateFormatter,
              props.listing.rentalObject.vacantFrom
            )}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
