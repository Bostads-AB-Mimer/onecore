import { Box, Skeleton } from '@mui/material'

import { ContactInfoRow } from './ContactInfo'

export const ContactInfoLoading = () => (
  <Box
    paddingTop="0.5rem"
    display="flex"
    width="100%"
    justifyContent="space-between"
    flex="1"
  >
    <Box flex="1">
      <ContactInfoRow
        label="Namn"
        value={
          <Skeleton
            variant="rectangular"
            width="125px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
      <ContactInfoRow
        label="Personnummer"
        value={
          <Skeleton
            variant="rectangular"
            width="100px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
      <ContactInfoRow
        label="Kundnummer"
        value={
          <Skeleton
            variant="rectangular"
            width="100px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
      <ContactInfoRow
        label="Adress"
        value={
          <Skeleton
            variant="rectangular"
            width="150px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
      <ContactInfoRow
        label="Område"
        value={
          <Skeleton
            variant="rectangular"
            width="75px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
      <ContactInfoRow
        label="Kontrakt"
        value={
          <Skeleton
            variant="rectangular"
            width="25px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
      <ContactInfoRow
        label="Köpoäng"
        value={
          <Skeleton
            variant="rectangular"
            width="50px"
            sx={{ marginTop: '7px' }}
          />
        }
      />
    </Box>
  </Box>
)
