import { FormControl, TextareaAutosize, Typography } from '@mui/material'
import React from 'react'
import { Controller, useFormContext } from 'react-hook-form'

const HousingReferenceComment: React.FC = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="housingReference.comment"
      control={control}
      defaultValue=""
      shouldUnregister
      render={({ field }) => (
        <FormControl fullWidth>
          <Typography variant="h2" paddingBottom={1}>
            Notering/kommentar
          </Typography>

          <TextareaAutosize {...field} minRows={3} />
        </FormControl>
      )}
    />
  )
}

export default HousingReferenceComment
