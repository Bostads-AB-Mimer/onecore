import { TextField } from '@mui/material'

type SearchBarProps = {
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
  value?: string
  list?: string
}

export const SearchBar = ({
  value,
  placeholder = 'Sök...',
  disabled = false,
  onChange,
  onBlur,
  onFocus,
}: SearchBarProps) => (
  <TextField
    size="small"
    variant="outlined"
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.value)}
    onFocus={onFocus}
    onBlur={onBlur}
  />
)
