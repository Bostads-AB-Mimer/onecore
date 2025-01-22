import {
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import React, { useState } from 'react'

const NotApproved: React.FC = () => (
  <>
    <FormControl fullWidth>
      <Typography paddingBottom={1} variant="h2">
        Anledning ej godkänd *
      </Typography>

      <Select name="current-type-of-housing" size="small" defaultValue="0">
        <MenuItem key={0} value={'0'}>
          Välj anledning
        </MenuItem>
        <MenuItem value="villa">Villa</MenuItem>
        <MenuItem value="lägenhet">Lägenhet</MenuItem>
        <MenuItem value="radhus">Radhus</MenuItem>
      </Select>
    </FormControl>

    <FormControl fullWidth>
      <Typography paddingBottom={1} variant="h2">
        Ej godkänd till och med *
      </Typography>

      <DatePicker />
    </FormControl>
  </>
)

const tabs: {
  [key: string]: JSX.Element | undefined
} = {
  approved: undefined,
  'not-approved': <NotApproved />,
  'contacted-no-response': undefined,
  'no-reference-required': undefined,
}

type HousingReferenceStatusFormProps = {
  defaultValue?: string
  value?: string
}

const HousingReferenceStatusForm = ({
  defaultValue = 'not-approved',
}: HousingReferenceStatusFormProps) => {
  const isMinWidth600 = useMediaQuery('(min-width:600px)')
  const [selectedTab, setSelectedTab] = useState<string>(defaultValue)

  return (
    <>
      <FormControl>
        <Typography variant="h2">Ange status boendereferens *</Typography>

        <RadioGroup
          name="status-housing-reference"
          defaultValue={defaultValue}
          row={isMinWidth600}
          onChange={(_, value) => setSelectedTab(value)}
        >
          <FormControlLabel
            value="approved"
            control={<Radio />}
            label="Godkänd"
          />
          <FormControlLabel
            value="not-approved"
            control={<Radio />}
            label="Ej godkänd"
          />
          <FormControlLabel
            value="contacted-no-response"
            control={<Radio />}
            label="Kontaktad - ej svar"
          />
          <FormControlLabel
            value="no-reference-required"
            control={<Radio />}
            label="Referens krävs ej"
          />
        </RadioGroup>
      </FormControl>

      {tabs[selectedTab]}
    </>
  )
}

export default HousingReferenceStatusForm
