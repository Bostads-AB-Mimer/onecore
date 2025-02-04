import { TextField } from '@mui/material'

import { mdTheme } from '../theme'

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
    sx={{
      width: '100%',
      maxWidth: 350,
      '& .MuiOutlinedInput-root': {
        fontSize: '16px',
        paddingTop: '2px',
        paddingBottom: '2px',
        color: '#000',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: mdTheme.palette.warmGrey.main,
          borderRadius: '6px',
          borderWidth: '1.5px',
        },
        '&.Mui-focused': {
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: '1.5px',
            borderColor: '#2e2e2e',
          },
        },
        '& .MuiInputLabel-outlined': {
          color: '#2e2e2e',
          '&.Mui-focused': {},
        },
      },
    }}
  />
)
