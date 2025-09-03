import { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { toast } from 'react-toastify'

import { useCloseParkingSpaceListing } from '../hooks/useCloseParkingSpaceListing'
import { ActionDialog } from '../../ParkingSpace/components/ActionDialog'

export const UnpublishListing = (props: { listingId: number }) => {
  const closeListing = useCloseParkingSpaceListing()
  const [open, setOpen] = useState(false)

  const onClose = () => {
    setOpen(false)
    closeListing.reset()
  }

  const onCloseListing = () =>
    closeListing.mutate(
      { listingId: props.listingId },
      {
        onSuccess: () => {
          setOpen(false)
          toast('Bilplatsannons avpublicerad', {
            type: 'success',
            hideProgressBar: true,
          })
        },
      }
    )

  return (
    <>
      <Button variant="dark" onClick={() => setOpen(true)}>
        Avpublicera
      </Button>
      <ActionDialog
        open={open}
        onClose={onClose}
        onConfirm={onCloseListing}
        title="Avpublicera bilplatsannons"
        content="Bekräfta att du vill avpublicera denna bilplatsannons"
        submitButtonText="Bekräfta"
        isPending={closeListing.isPending}
        error={
          closeListing.error ? (
            <Typography
              color="error"
              textAlign="center"
              paddingTop="1rem"
              paddingBottom="2rem"
            >
              Något gick fel. Kontakta support.
            </Typography>
          ) : undefined
        }
      />
    </>
  )
}
