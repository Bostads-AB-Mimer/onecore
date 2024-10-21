import { useState } from 'react'
import { IconButton, Backdrop, Menu } from '@mui/material'
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state'
import { MoreHoriz } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { useRemoveApplicantFromListing } from '../hooks/useRemoveApplicantFromListing'
import { ActionDialog } from './ActionDialog'
import { PopupMenuItem } from './PopupMenuItem'

export interface Props {
  applicantId: number
  applicantName: string
  listingAddress: string
  listingId: number
  disabled: boolean
}

export const ApplicantActions = (props: Props) => {
  const removeListing = useRemoveApplicantFromListing()
  const [open, setOpen] = useState(false)

  const onRemove = () =>
    removeListing.mutate(props, {
      onSuccess: () => {
        setOpen(false)
        toast('Intresseanmälan borttagen', {
          type: 'success',
          hideProgressBar: true,
        })
      },
    })

  return (
    <>
      <PopupState
        variant="popover"
        popupId="remove-applicant-from-listing-popup-menu"
        disableAutoFocus={false}
        parentPopupState={null}
      >
        {(popupState) => (
          <>
            <IconButton {...bindTrigger(popupState)} sx={{ padding: 0 }}>
              <MoreHoriz />
            </IconButton>
            <Backdrop open={popupState.isOpen} onClick={popupState.close}>
              <Menu
                {...bindMenu(popupState)}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                elevation={0}
              >
                <PopupMenuItem
                  label="Ta bort anmälan"
                  onClick={() => setOpen(true)}
                  closeMenu={popupState.close}
                />
              </Menu>
            </Backdrop>
          </>
        )}
      </PopupState>
      <ActionDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onRemove}
        title="Ta bort intresseanmälan"
        content={`Vill du ta bort ${props.applicantName} som intressent för ${props.listingAddress}?`}
        submitButtonText="Ja, ta bort"
        isPending={removeListing.isPending}
      />
    </>
  )
}
