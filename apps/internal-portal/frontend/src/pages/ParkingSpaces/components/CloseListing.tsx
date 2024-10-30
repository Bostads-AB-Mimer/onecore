import { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { toast } from 'react-toastify'

import { useCloseParkingSpaceListing } from '../hooks/useCloseParkingSpaceListing'
import { ActionDialog } from '../../ParkingSpace/components/ActionDialog'

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
          toast('Bilplatsannons markerad som ompublicerad', {
            type: 'success',
            hideProgressBar: true,
          })
        },
      }
    )

  return (
    <>
      <Button variant="dark" onClick={() => setOpen(true)}>
        Markera som publicerad
      </Button>
      <ActionDialog
        open={open}
        onClose={onClose}
        onConfirm={onCloseListing}
        title="Markera som publicerad"
        content="Bekräfta att du publicerat denna bilplats i Xpand"
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
