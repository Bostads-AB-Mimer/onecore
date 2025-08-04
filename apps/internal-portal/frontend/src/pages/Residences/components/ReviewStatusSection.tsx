import React from 'react'
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { Controller, useFormContext } from 'react-hook-form'
import { z } from 'zod'
import dayjs from 'dayjs'
import { schemas } from 'onecore-types'

type ReviewStatus = z.infer<
  typeof schemas.v1.HousingReferenceReviewStatusSchema
>

const ReviewStatusSection = () => {
  const { control, watch } = useFormContext()
  const reviewStatus: ReviewStatus = watch('housingReference.reviewStatus')

  const isMinWidth600 = useMediaQuery('(min-width:600px)')

  return (
    <Grid container columnSpacing={1} className="form-field-group">
      <Grid item xs={12}>
        <Controller
          name="housingReference.reviewStatus"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <Typography variant="h2">Ange status boendereferens *</Typography>

              <RadioGroup
                row={isMinWidth600}
                {...field}
                sx={{ paddingLeft: '10px' }}
              >
                <FormControlLabel
                  value="APPROVED"
                  control={<Radio />}
                  label="Godkänd"
                />
                <FormControlLabel
                  value="REJECTED"
                  control={<Radio />}
                  label="Ej godkänd"
                />
                <FormControlLabel
                  value="CONTACTED_UNREACHABLE"
                  control={<Radio />}
                  label="Kontaktad - ej svar"
                />
                <FormControlLabel
                  value="REFERENCE_NOT_REQUIRED"
                  control={<Radio />}
                  label="Referens krävs ej"
                />
              </RadioGroup>
            </FormControl>
          )}
        />
        {reviewStatus === 'REJECTED' && (
          <>
            <Controller
              name="housingReference.reasonRejected"
              control={control}
              rules={{
                required: {
                  value: true,
                  message: 'Du behöver välja en anledning',
                },
              }}
              render={({ field, fieldState }) => (
                <FormControl fullWidth>
                  <Typography paddingBottom={1} variant="h2">
                    Anledning ej godkänd *
                  </Typography>

                  <Select
                    size="small"
                    error={fieldState.invalid}
                    displayEmpty
                    {...field}
                  >
                    <MenuItem value="" disabled>
                      Välj ur lista
                    </MenuItem>

                    <MenuItem value="DEBT_TO_LANDLORD">Skuld</MenuItem>
                    <MenuItem value="DISTURBANCE">Störningar</MenuItem>
                    <MenuItem value="LATE_RENT_PAYMENT">
                      Sena betalningar
                    </MenuItem>
                    <MenuItem value="MISMANAGEMENT">Vanvård</MenuItem>
                  </Select>

                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
            <Controller
              name="housingReference.expiresAt"
              control={control}
              shouldUnregister
              defaultValue={dayjs()}
              render={({ field, fieldState }) => (
                <FormControl fullWidth>
                  <Typography paddingBottom={1} variant="h2">
                    Ej godkänd till och med *
                  </Typography>

                  <DatePicker format="YYYY-MM-DD" {...field} />

                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </>
        )}
      </Grid>
    </Grid>
  )
}

export default ReviewStatusSection
