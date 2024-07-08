import { Box, Typography } from '@mui/material'
import { Contact } from 'onecore-types'

export const ContactInfo = (props: { contact: Contact | null }) => (
  <Box>
    <Box
      paddingTop="1rem"
      display="flex"
      justifyContent="space-between"
      flex="1"
    >
      <Typography>Namn</Typography>
      <Box>
        <Typography fontWeight="bold">{props.contact?.fullName}</Typography>
      </Box>
    </Box>
    <Box
      display="flex"
      justifyContent="space-between"
      flex="1"
      paddingTop="0.5rem"
    >
      <Typography>Adress</Typography>
      <Box>
        <Typography fontWeight="bold">
          {props.contact?.address?.street} {props.contact?.address?.number}
        </Typography>
      </Box>
    </Box>
    <Box
      display="flex"
      justifyContent="space-between"
      flex="1"
      paddingTop="0.5rem"
    >
      <Typography>Område</Typography>
      <Box>
        <Typography fontWeight="bold">N/A</Typography>
      </Box>
    </Box>
    <Box
      display="flex"
      justifyContent="space-between"
      flex="1"
      paddingTop="0.5rem"
    >
      <Typography>Kontraktstatus bostad</Typography>
      <Box>
        <Typography fontWeight="bold">N/A</Typography>
      </Box>
    </Box>
    <Box
      display="flex"
      justifyContent="space-between"
      flex="1"
      paddingTop="0.5rem"
    >
      <Typography>Kontrakt bilplats</Typography>
      <Box>
        <Typography fontWeight="bold">N/A</Typography>
      </Box>
    </Box>
  </Box>
)
