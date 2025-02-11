import { FormControl, Typography, TextField } from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

const HousingTypeDescription: React.FC = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="housingTypeDescription"
      control={control}
      shouldUnregister
      defaultValue=""
      render={({ field }) => (
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Beskriv boende *
          </Typography>

          <TextField size="small" {...field} />
        </FormControl>
      )}
    />
  )
}

export default HousingTypeDescription
