import { Box, Button, Typography } from '@mui/material'
import { ListingStatus } from 'onecore-types'

import { useParkingSpaceListing } from '../hooks/useParkingSpaceListing'
import { useCreateOffer } from '../hooks/useCreateOffer'

export const ParkingSpaceInfo = (props: { listingId: number }) => {
  const { data: parkingSpaceListing } = useParkingSpaceListing({
    id: props.listingId,
  })

  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  const createOffer = useCreateOffer()

  const onCreateOffer = () => {
    createOffer.mutate(props, {})
  }

  const getMapImageUrl = (rentalObjectCodes: string) => {
    const identifier = rentalObjectCodes.slice(0, 7)
    return `https://pub.mimer.nu/bofaktablad/mediabank/byggnad/${identifier}_1.jpg`
  }

  const renderStartOfferProcessButton = (listingStatus: ListingStatus) => {
    if (listingStatus == ListingStatus.Expired) {
      return (
        <Box paddingY="1rem">
          <Button variant="dark-outlined" onClick={() => onCreateOffer()}>
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
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '4rem',
          height: '21rem',
          '@media (max-width: 62.5rem)': {
            flexDirection: 'column',
            gap: '2rem',
            height: 'auto',
          },
        }}
      >
        <Box flex="0.25" paddingX="1rem" sx={{ minWidth: '400px' }}>
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
        <Box
          flex="1"
          sx={{
            width: '100%',
            cursor: 'pointer',
          }}
          onClick={() =>
            window.open(
              getMapImageUrl(parkingSpaceListing.rentalObjectCode),
              '_blank'
            )
          }
        >
          <Box
            component="img"
            src={getMapImageUrl(parkingSpaceListing.rentalObjectCode)}
            alt="parking space map image"
            sx={{
              objectFit: 'contain',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
        </Box>
      </Box>
      {renderStartOfferProcessButton(parkingSpaceListing.status)}
    </Box>
  )
}
