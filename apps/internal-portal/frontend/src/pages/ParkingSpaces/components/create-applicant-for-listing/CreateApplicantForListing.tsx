import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Divider,
  Radio,
  FormControlLabel,
  RadioGroup,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Listing } from 'onecore-types'
import { toast } from 'react-toastify'
import { LoadingButton } from '@mui/lab'

import {
  CreateApplicantRequestParams,
  useCreateApplicantForListing,
} from '../../hooks/useCreateApplicantForListing'
import { SearchContact } from './SearchContact'
import { ListingInfo } from './ListingInfo'
import { ContactSearchData } from './types'
import { useContactByContactCode } from '../../hooks/useContactByContactCode'
import { ContactInfo } from './ContactInfo'

export interface Props {
  listing: Listing
  disabled: boolean
}

export const CreateApplicantForListing = (props: Props) => {
  const createApplicant = useCreateApplicantForListing(props.listing.id)
  const [open, setOpen] = useState(false)
  const [selectedContact, setSelectedContact] =
    useState<ContactSearchData | null>(null)

  const [applicationType, setApplicationType] = useState<
    'Replace' | 'Additional'
  >()

  const contactQuery = useContactByContactCode(selectedContact?.contactCode)

  const onCreate = (params: CreateApplicantRequestParams) =>
    createApplicant.mutate(params, {
      onSuccess: () => {
        onCloseModal()
        toast('Intresseanmälan skapad', {
          type: 'success',
          hideProgressBar: true,
        })
      },
    })

  const onCloseModal = () => {
    setOpen(false)
    setSelectedContact(null)
    setApplicationType(undefined)
  }

  return (
    <>
      <Button
        disabled={props.disabled}
        variant="dark"
        onClick={() => setOpen(true)}
      >
        <Box
          sx={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          Ny anmälan
        </Box>
      </Button>
      <Dialog onClose={onCloseModal} open={open} maxWidth="xs" fullWidth>
        {createApplicant.error ? (
          <CreateApplicantError reset={createApplicant.reset} />
        ) : (
          <Box paddingTop="1rem">
            <Box display="flex">
              <DialogTitle variant="h1" fontSize={24} textAlign="left">
                Ny intresseanmälan, {props.listing.address}
              </DialogTitle>
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                marginLeft="auto"
                marginRight="1rem"
              >
                <IconButton onClick={() => setOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            <DialogContent sx={{ paddingTop: '0.5rem' }}>
              <Box paddingX="0.5rem">
                <Typography variant="h2">Objektsinformation</Typography>
                <ListingInfo listing={props.listing} />
              </Box>
              <Box paddingX="0.5rem" paddingTop="1rem">
                <Typography variant="h2">Kundinformation</Typography>
                <SearchContact
                  onSelect={setSelectedContact}
                  contact={selectedContact}
                />
                <ContactInfo contact={contactQuery.data ?? null} />
              </Box>
              <Box paddingX="0.5rem">
                <Divider />
              </Box>
              <Box
                paddingX="0.5rem"
                paddingTop="0.5rem"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography>Ärendetyp</Typography>
                <RadioGroup name="radio-buttons-group" row>
                  <FormControlLabel
                    checked={applicationType === 'Replace'}
                    control={<Radio size="small" />}
                    label="Byte"
                    onChange={() => setApplicationType('Replace')}
                  />
                  <FormControlLabel
                    checked={applicationType === 'Additional'}
                    control={<Radio size="small" />}
                    label="Hyra flera"
                    onChange={() => setApplicationType('Additional')}
                  />
                </RadioGroup>
              </Box>
              <Box
                paddingTop="2rem"
                display="flex"
                justifyContent="space-between"
              >
                <Button onClick={onCloseModal} variant="dark-outlined">
                  Avbryt
                </Button>
                {contactQuery.data && applicationType ? (
                  <LoadingButton
                    disabled={false}
                    loading={createApplicant.isPending}
                    variant="dark"
                    onClick={() =>
                      onCreate({
                        applicationType,
                        contactCode: contactQuery.data.contactCode,
                        parkingSpaceId: props.listing.rentalObjectCode,
                      })
                    }
                  >
                    Spara
                  </LoadingButton>
                ) : (
                  <Button disabled variant="dark">
                    Lägg till
                  </Button>
                )}
              </Box>
            </DialogContent>
          </Box>
        )}
      </Dialog>
    </>
  )
}

const CreateApplicantError = (props: { reset: () => void }) => (
  <Box
    padding="1rem"
    height="250px"
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="space-between"
  >
    <Typography textAlign="center" variant="h1">
      Något gick fel...
    </Typography>
    <Box>Försök igen eller kontakta support</Box>
    <Box paddingTop="2rem">
      <Button variant="dark-outlined" onClick={props.reset}>
        Försök igen
      </Button>
    </Box>
  </Box>
)
