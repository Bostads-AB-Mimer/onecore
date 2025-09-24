import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { toast } from 'react-toastify'
import { LoadingButton } from '@mui/lab'

import { useDeleteParkingSpaceListing } from '../hooks/useDeleteParkingSpaceListing'

export const DeleteListing = (props: {
  disabled: boolean
  address: string
  rentalObjectCode: string
  id: number
}) => {
  const deleteListing = useDeleteParkingSpaceListing()
  const [open, setOpen] = useState(false)

  const onClose = () => {
    setOpen(false)
    deleteListing.reset()
  }
  const onDelete = () =>
    deleteListing.mutate(
      { listingId: props.id },
      {
        onSuccess: () => {
          setOpen(false)
          toast('Bilplatsannons borttagen', {
            type: 'success',
            hideProgressBar: true,
          })
        },
      }
    )

  return (
    <>
      <Button
        disabled={props.disabled}
        variant="dark"
        onClick={() => setOpen(true)}
      >
        Radera
      </Button>
      <Dialog
        onClose={onClose}
        open={open}
        maxWidth="xs"
        TransitionProps={{ exit: false }}
      >
        <Box paddingTop="0.5rem">
          <Box display="flex">
            <DialogTitle variant="h1" fontSize={24} textAlign="left">
              Radera bilplatsannons
            </DialogTitle>
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              marginLeft="auto"
              marginRight="1rem"
            >
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <DialogContent>
            <Typography
              textAlign="center"
              paddingTop="1rem"
              paddingBottom="2rem"
            >
              Vill du ta bort bilplatsannons {props.address} med hyresid{' '}
              {props.rentalObjectCode}?
            </Typography>
            {deleteListing.error && (
              <Typography
                color="error"
                textAlign="center"
                paddingTop="1rem"
                paddingBottom="2rem"
              >
                Det gick inte att ta bort bilplatsen. Troligtvis för att det
                redan finns intresseanmälningar på den. Kontakta support.
              </Typography>
            )}
            <Box
              display="flex"
              gap="6rem"
              justifyContent="space-between"
              paddingTop="1rem"
            >
              <Button
                variant="dark-outlined"
                onClick={onClose}
                disabled={deleteListing.isPending}
              >
                Avbryt
              </Button>
              <LoadingButton
                variant="dark"
                onClick={onDelete}
                loading={deleteListing.isPending}
              >
                Bekräfta
              </LoadingButton>
            </Box>
          </DialogContent>
        </Box>
      </Dialog>
    </>
  )
}
