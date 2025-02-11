import React from 'react'
import {
  FormControl,
  FormHelperText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

import { HousingTypes } from '../../constants'

const HousingType = () => {
  const { control } = useFormContext()

  return (
    <Controller
      name="housingType"
      control={control}
      shouldUnregister
      defaultValue=""
      rules={{
        required: { value: true, message: 'Du behöver välja en boendeform' },
      }}
      render={({ field, fieldState }) => (
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Boendeform *
          </Typography>

          <Select
            size="small"
            displayEmpty
            error={fieldState.invalid}
            {...field}
          >
            <MenuItem value="" disabled>
              Välj ur lista
            </MenuItem>

            <MenuItem value={HousingTypes.RENTAL}>Hyresrätt</MenuItem>
            <MenuItem value={HousingTypes.SUB_RENTAL}>Andrahand</MenuItem>
            <MenuItem value={HousingTypes.LIVES_WITH_FAMILY}>
              Bor hos förälder
            </MenuItem>
            <MenuItem value={HousingTypes.LODGER}>Inneboende</MenuItem>
            <MenuItem value={HousingTypes.OWNS_HOUSE}>Äger villa</MenuItem>
            <MenuItem value={HousingTypes.OWNS_FLAT}>Äger bostadsrätt</MenuItem>
            <MenuItem value={HousingTypes.OWNS_ROW_HOUSE}>Äger radhus</MenuItem>
            <MenuItem value={HousingTypes.OTHER}>Övrigt/annat</MenuItem>
          </Select>

          <FormHelperText>{fieldState.error?.message}</FormHelperText>
        </FormControl>
      )}
    />
  )
}

export default HousingType
