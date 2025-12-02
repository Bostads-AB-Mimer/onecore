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
import { LoadingButton } from '@mui/lab'

interface ActionDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  content: string
  submitButtonText: string
  closeButtonText?: string
  isPending: boolean
  error?: JSX.Element
}

export const ActionDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  content,
  closeButtonText = 'Avbryt',
  submitButtonText,
  isPending,
  error,
}: ActionDialogProps) => {
  return (
    <Dialog onClose={onClose} open={open} maxWidth="xs">
      <Box>
        <Box display="flex">
          <DialogTitle variant="h2" textAlign="left">
            {title}
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
          <Typography textAlign="center" paddingTop="1rem" paddingBottom="2rem">
            {content}
          </Typography>
          {error && error}
          <Box
            display="flex"
            gap="6rem"
            justifyContent="space-between"
            paddingTop="1rem"
          >
            <Button
              variant="dark-outlined"
              onClick={onClose}
              disabled={isPending}
            >
              {closeButtonText}
            </Button>
            <LoadingButton
              variant="dark"
              onClick={onConfirm}
              loading={isPending}
            >
              {submitButtonText}
            </LoadingButton>
          </Box>
        </DialogContent>
      </Box>
    </Dialog>
  )
}
