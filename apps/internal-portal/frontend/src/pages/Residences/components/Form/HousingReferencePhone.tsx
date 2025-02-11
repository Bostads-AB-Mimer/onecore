import { FormControl, Typography, TextField } from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

const HousingReferencePhone: React.FC = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="housingReference.phone"
      control={control}
      defaultValue=""
      shouldUnregister
      render={({ field }) => (
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Telefonnummer hyresvärd *
          </Typography>

          <TextField size="small" type="tel" {...field} />
        </FormControl>
      )}
    />
  )
}

export default HousingReferencePhone
