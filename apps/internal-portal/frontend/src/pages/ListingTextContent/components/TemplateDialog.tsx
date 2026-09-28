import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import type { ListingTextTemplate } from '../templates/listingTextTemplates'
import {
  DEFAULT_ROOM_COUNT,
  MAX_ROOM_COUNT,
  MIN_ROOM_COUNT,
  isValidRoomCount,
} from '../utils/templates'

export type ApplyTemplateMode = 'replace' | 'append'

interface TemplateFormProps {
  templates: ListingTextTemplate[]
  // Room count derived from the rental object, when known.
  suggestedRoomCount?: number
  hasExistingBlocks: boolean
  onCancel: () => void
  onApply: (
    template: ListingTextTemplate,
    roomCount: number,
    mode: ApplyTemplateMode
  ) => void
}

// The form is rendered as the Dialog's children, so it mounts fresh on every
// open and its initial state is read from props exactly once per open.
const TemplateForm = ({
  templates,
  suggestedRoomCount,
  hasExistingBlocks,
  onCancel,
  onApply,
}: TemplateFormProps) => {
  const [templateId, setTemplateId] = useState(templates[0].id)
  // Kept as a string so the field can be cleared while typing.
  const [roomCountInput, setRoomCountInput] = useState(
    String(suggestedRoomCount ?? DEFAULT_ROOM_COUNT)
  )
  const [mode, setMode] = useState<ApplyTemplateMode>('append')

  const template = templates.find((t) => t.id === templateId) ?? templates[0]
  const needsRoomCount = Boolean(template.roomSection)

  const roomCount = Number(roomCountInput)
  const roomCountValid =
    !needsRoomCount ||
    (roomCountInput.trim() !== '' && isValidRoomCount(roomCount))

  const handleApply = () => {
    if (!roomCountValid) return
    onApply(template, roomCount, mode)
  }

  return (
    <>
      <DialogTitle>Använd mall</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ marginTop: 1 }}>
          <FormControl fullWidth size="small">
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Mall
            </Typography>
            <Select
              value={template.id}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ marginTop: 1 }}
            >
              {template.description}
            </Typography>
          </FormControl>

          {needsRoomCount && (
            <TextField
              label="Antal rum"
              type="number"
              size="small"
              value={roomCountInput}
              onChange={(e) => setRoomCountInput(e.target.value)}
              inputProps={{ min: MIN_ROOM_COUNT, max: MAX_ROOM_COUNT, step: 1 }}
              error={!roomCountValid}
              helperText={
                roomCountValid
                  ? 'Ett avsnitt (underrubrik + text) läggs till per rum'
                  : `Ange ett heltal mellan ${MIN_ROOM_COUNT} och ${MAX_ROOM_COUNT}`
              }
            />
          )}

          {hasExistingBlocks && (
            <FormControl>
              <FormLabel>Befintliga block</FormLabel>
              <RadioGroup
                value={mode}
                onChange={(e) => setMode(e.target.value as ApplyTemplateMode)}
              >
                <FormControlLabel
                  value="append"
                  control={<Radio size="small" />}
                  label="Lägg till mallen efter befintliga block"
                />
                <FormControlLabel
                  value="replace"
                  control={<Radio size="small" />}
                  label="Ersätt befintliga block med mallen"
                />
              </RadioGroup>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="dark-outlined" onClick={onCancel}>
          Avbryt
        </Button>
        <Button variant="dark" onClick={handleApply} disabled={!roomCountValid}>
          Använd mall
        </Button>
      </DialogActions>
    </>
  )
}

interface TemplateDialogProps extends Omit<TemplateFormProps, 'onCancel'> {
  open: boolean
  onClose: () => void
}

export const TemplateDialog = ({
  open,
  onClose,
  onApply,
  ...formProps
}: TemplateDialogProps) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <TemplateForm
      {...formProps}
      onCancel={onClose}
      onApply={(template, roomCount, mode) => {
        onApply(template, roomCount, mode)
        onClose()
      }}
    />
  </Dialog>
)
