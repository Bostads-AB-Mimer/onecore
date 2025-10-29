import { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { toast } from 'react-toastify'

import { useUnpublishParkingSpaceListing } from '../hooks/useUnpublishParkingSpaceListing'
import { ActionDialog } from './ActionDialog'

export const UnpublishListing = (props: {
  listingId: number
  onUnpublished?: () => void
}) => {
  const unpublishListing = useUnpublishParkingSpaceListing()
  const [open, setOpen] = useState(false)

  const onUnpublish = () => {
    setOpen(false)
    unpublishListing.reset()
  }

  const onUnpublishListing = () =>
    unpublishListing.mutate(
      { listingId: props.listingId },
      {
        onSuccess: () => {
          setOpen(false)
          toast('Bilplatsannons avpublicerad', {
            type: 'success',
            hideProgressBar: true,
          })
          props.onUnpublished?.()
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
        onClose={onUnpublish}
        onConfirm={onUnpublishListing}
        title="Avpublicera bilplatsannons"
        content="Publiceringstiden har ännu inte gått ut. Bekräfta att du vill avpublicera annonsen i förtid. Annonsen kommer att bli redo för erbjudande."
        submitButtonText="Bekräfta"
        closeButtonText="Stäng"
        isPending={unpublishListing.isPending}
        error={
          unpublishListing.error ? (
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
