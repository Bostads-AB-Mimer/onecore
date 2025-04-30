import { FormControl, Typography, TextField } from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

const NumChildren: React.FC = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="numChildren"
      control={control}
      shouldUnregister
      defaultValue={0}
      render={({ field }) => (
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Antal barn i hushåll *
          </Typography>

          <TextField
            type="number"
            variant="outlined"
            size="small"
            InputProps={{ inputProps: { min: 0 } }}
            {...field}
            onChange={({ target }) => field.onChange(parseInt(target.value))}
          />
        </FormControl>
      )}
    />
  )
}

export default NumChildren
