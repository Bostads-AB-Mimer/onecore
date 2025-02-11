import { FormControl, Typography, TextField } from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

const Landlord: React.FC = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="landlord"
      control={control}
      shouldUnregister
      defaultValue=""
      render={({ field }) => (
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Hyresvärd *
          </Typography>

          <TextField
            size="small"
            placeholder="Namn på nuvarande hyresvärd"
            {...field}
          />
        </FormControl>
      )}
    />
  )
}

export default Landlord
