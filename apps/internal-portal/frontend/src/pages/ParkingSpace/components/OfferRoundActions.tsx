import { useState } from 'react'
import { IconButton, Backdrop, Menu } from '@mui/material'
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state'
import { MoreHoriz } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { ReplyToOfferErrorCodes } from 'onecore-types'

import { useAcceptOffer } from '../hooks/useAcceptOffer'
import { useDenyOffer } from '../hooks/useDenyOffer'
import { ActionDialog } from './ActionDialog'
import { PopupMenuItem } from './PopupMenuItem'
import { RequestError } from '../../../types'

export interface Props {
  offerId: number
  listingId: number
  applicantName: string
  disabled: boolean
}

export const OfferRoundActions = (props: Props) => {
  const replyYes = useAcceptOffer()
  const replyNo = useDenyOffer()
  const [replyYesOpen, setReplyYesOpen] = useState(false)
  const [replyNoOpen, setReplyNoOpen] = useState(false)

  const onReplyYes = () =>
    replyYes.mutate(props, {
      onSuccess: () => {
        setReplyYesOpen(false)
        toast('Erbjudande accepterat', {
          type: 'success',
          hideProgressBar: true,
        })
      },
      onError: (error: RequestError<ReplyToOfferErrorCodes>) => {
        setReplyYesOpen(false)
        toast(error.errorMessage, {
          type: 'error',
          hideProgressBar: true,
        })
      },
    })

  const onReplyNo = () =>
    replyNo.mutate(props, {
      onSuccess: () => {
        setReplyNoOpen(false)
        toast('Erbjudande nekat', {
          type: 'info',
          hideProgressBar: true,
        })
      },
      onError: (error: RequestError<ReplyToOfferErrorCodes>) => {
        setReplyNoOpen(false)
        toast(error.errorMessage, {
          type: 'error',
          hideProgressBar: true,
        })
      },
    })

  return (
    <>
      <PopupState
        variant="popover"
        popupId="reply-to-offer-popup-menu"
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
                  label="Tacka ja"
                  onClick={() => setReplyYesOpen(true)}
                  closeMenu={popupState.close}
                />
                <PopupMenuItem
                  label="Tacka nej"
                  onClick={() => setReplyNoOpen(true)}
                  closeMenu={popupState.close}
                />
              </Menu>
            </Backdrop>
          </>
        )}
      </PopupState>
      <ActionDialog
        open={replyYesOpen}
        onClose={() => setReplyYesOpen(false)}
        onConfirm={onReplyYes}
        title="Svara på erbjudande"
        content={`Tacka ja åt ${props.applicantName}?`}
        submitButtonText="Bekfräfta tacka ja"
        isPending={replyYes.isPending}
      />
      <ActionDialog
        open={replyNoOpen}
        onClose={() => setReplyNoOpen(false)}
        onConfirm={onReplyNo}
        title="Svara på erbjudande"
        content={`Tacka nej åt ${props.applicantName}?`}
        submitButtonText="Bekräfta tacka nej"
        isPending={replyNo.isPending}
      />
    </>
  )
}
