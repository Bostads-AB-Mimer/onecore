import { FormControl, TextareaAutosize, Typography } from '@mui/material'
import React from 'react'

const AdditionalNotesForm: React.FC = () => {
  return (
    <FormControl fullWidth>
      <Typography variant="h2" paddingBottom={1}>
        Notering/kommentar
      </Typography>

      <TextareaAutosize name="notes" minRows={3} />
    </FormControl>
  )
}

export default AdditionalNotesForm
