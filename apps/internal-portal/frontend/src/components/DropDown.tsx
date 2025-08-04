import { Box, InputLabel, MenuItem, Select } from '@mui/material'

export interface DropDownOption {
  value: string
  label: string
}

const DropDown = ({
  id,
  label,
  defaultValue,
  options,
  onSelect,
}: {
  id: string
  label: string
  defaultValue?: string
  options: Array<DropDownOption>
  onSelect?: (value: string) => void
}) => {
  const handleSelection = (event: any) => {
    if (onSelect) onSelect(event.target.value)
  }

  return (
    <Box key={id}>
      <InputLabel id={id + '-select-label'}>{label}</InputLabel>
      <Select
        labelId={id + '-select-label'}
        id={id + '-select'}
        defaultValue={defaultValue}
        onChange={handleSelection}
        sx={{ width: '240px' }}
      >
        <MenuItem key={id + '-0'} value={'0'}>
          Välj ur lista
        </MenuItem>
        {options?.map((option: DropDownOption) => (
          <MenuItem key={id + '-' + option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  )
}
export default DropDown
