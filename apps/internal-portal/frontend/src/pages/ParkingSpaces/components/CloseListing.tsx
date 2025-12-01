import { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { toast } from 'react-toastify'

import { ActionDialog } from '../../ParkingSpace/components/ActionDialog'
import { useCloseParkingSpaceListing } from '../hooks/useCloseParkingSpaceListing'
import { ListingStatus } from '@onecore/types'

export const CloseListing = (props: {
  listingId: number
  currentStatus: ListingStatus
}) => {
  const closeListing = useCloseParkingSpaceListing()
  const [open, setOpen] = useState(false)

  const toastMessage =
    props.currentStatus === ListingStatus.Active
      ? 'Annonsering avbruten.'
      : 'Uthyrning avbruten.'

  const title =
    props.currentStatus === ListingStatus.Active
      ? 'Avbryt publicering'
      : 'Avbryt uthyrning'

  const content =
    props.currentStatus === ListingStatus.Active
      ? 'Bekräfta att du vill avbryta publiceringen av denna annons. En kommentar kommer att läggas till om att du avbrutit publiceringen.'
      : 'Bekräfta att du vill avbryta uthyrningen av denna bilplats. En kommentar kommer att läggas till om att du avbrutit uthyrningen.'

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
          toast(toastMessage, {
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
        title={title}
        content={content}
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
