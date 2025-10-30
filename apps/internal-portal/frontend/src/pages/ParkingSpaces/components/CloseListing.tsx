import { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { toast } from 'react-toastify'

import { ActionDialog } from '../../ParkingSpace/components/ActionDialog'
import { useCloseParkingSpaceListing } from '../hooks/useCloseParkingSpaceListing'

export const CloseListing = (props: { listingId: number }) => {
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
          toast('Bilplatsannonsering avbruten.', {
            type: 'success',
            hideProgressBar: true,
          })
        },
      }
    )

  return (
    <>
      <Button variant="dark" onClick={() => setOpen(true)}>
        Avbryt
      </Button>
      <ActionDialog
        open={open}
        onClose={onClose}
        onConfirm={onCloseListing}
        title="Avbryt publicering"
        content="Bekräfta att du vill avbryta publiceringen av denna bilplatsannons. En kommentar kommer att läggas till om att du avbrutit publiceringen av denna bilplatsannons."
        submitButtonText="Bekräfta"
        closeButtonText="Stäng"
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
