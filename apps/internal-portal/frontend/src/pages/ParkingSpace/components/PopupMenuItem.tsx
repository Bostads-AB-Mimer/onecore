import { MenuItem, Button } from '@mui/material'

interface ReplyMenuItemProps {
  label: string
  onClick: () => void
  closeMenu: () => void
}

export const PopupMenuItem = ({
  label,
  onClick,
  closeMenu,
}: ReplyMenuItemProps) => {
  return (
    <MenuItem onClick={closeMenu}>
      <Button
        variant="text"
        onClick={onClick}
        sx={{
          color: 'black',
          border: 'none',
          backgroundColor: 'transparent',
          paddingRight: 8,
          '&:hover': {
            backgroundColor: 'transparent',
          },
        }}
      >
        {label}
      </Button>
    </MenuItem>
  )
}
