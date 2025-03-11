import { Box, Typography } from '@mui/material'
import { Tenant } from 'onecore-types'

export const ContactInfoRow = (props: {
  label: string
  value: JSX.Element
}) => (
  <Box paddingTop="0.5rem" display="flex" justifyContent="space-between">
    <Typography>{props.label}</Typography>
    <Box>{props.value}</Box>
  </Box>
)

export const ContactInfo = (props: { tenant: Tenant | null }) => (
  <Box paddingTop="0.5rem">
    <ContactInfoRow
      label="Namn"
      value={<Typography>{props.tenant?.fullName}</Typography>}
    />
    <ContactInfoRow
      label="Personnummer"
      value={
        <Typography>{props.tenant?.nationalRegistrationNumber}</Typography>
      }
    />
    <ContactInfoRow
      label="Kundnummer"
      value={<Typography>{props.tenant?.contactCode}</Typography>}
    />
    <ContactInfoRow
      label="Adress"
      value={
        <Typography>
          {props.tenant?.address?.street}, {props.tenant?.address?.postalCode}{' '}
          {props.tenant?.address?.city}
        </Typography>
      }
    />
    <ContactInfoRow
      label="Område bostadskontrakt"
      value={
        <Typography>
          {props.tenant?.currentHousingContract?.residentialArea?.caption ||
            props.tenant?.upcomingHousingContract?.residentialArea?.caption}
        </Typography>
      }
    />
    <ContactInfoRow
      label="Kontrakt"
      value={<Typography>{props.tenant?.leaseIds?.length}</Typography>}
    />
    <ContactInfoRow
      label="Köpoäng"
      value={
        <Typography>
          {props.tenant?.parkingSpaceWaitingList?.queuePoints}
        </Typography>
      }
    />
  </Box>
)
