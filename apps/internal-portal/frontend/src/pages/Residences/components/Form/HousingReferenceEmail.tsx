import { FormControl, Typography, TextField } from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

const HousingReferenceEmail: React.FC = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="housingReference.email"
      control={control}
      defaultValue=""
      shouldUnregister
      render={({ field }) => (
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Mejladress hyresvärd
          </Typography>

          <TextField size="small" type="email" {...field} />
        </FormControl>
      )}
    />
  )
}

export default HousingReferenceEmail
