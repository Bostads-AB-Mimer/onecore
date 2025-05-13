import React from 'react'
import {
  FormControl,
  FormHelperText,
  Grid,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'

import HousingTypeDetailsSection from '../HousingTypeDetailsSection'

const HousingType = () => {
  const { control } = useFormContext()

  return (
    <Grid container columnSpacing={1} className="form-field-group">
      <Grid item xs={12}>
        <Controller
          name="housingType"
          control={control}
          shouldUnregister
          defaultValue=""
          rules={{
            required: {
              value: true,
              message: 'Du behöver välja en boendeform',
            },
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

                <MenuItem value="RENTAL">Hyresrätt</MenuItem>
                <MenuItem value="SUB_RENTAL">Andrahand</MenuItem>
                <MenuItem value="LIVES_WITH_FAMILY">Bor hos förälder</MenuItem>
                <MenuItem value="LODGER">Inneboende</MenuItem>
                <MenuItem value="OWNS_HOUSE">Äger villa</MenuItem>
                <MenuItem value="OWNS_FLAT">Äger bostadsrätt</MenuItem>
                <MenuItem value="OWNS_ROW_HOUSE">Äger radhus</MenuItem>
                <MenuItem value="OTHER">Övrigt/annat</MenuItem>
              </Select>

              <FormHelperText>{fieldState.error?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Grid>
      <HousingTypeDetailsSection />
    </Grid>
  )
}

export default HousingType
