import {
  Box,
  IconButton,
  MenuItem,
  Menu,
  Typography,
  Button,
  Backdrop,
} from '@mui/material'
import PopupState, { bindTrigger, bindMenu } from 'material-ui-popup-state'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import { Link } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

const menuItems = [
  { label: 'Bilplatser', to: '/bilplatser' },
  { label: 'Publicera bilplatser', to: '/bilplatser/publicera' },
  { label: 'Sök bilplats', to: '/sok-bilplats' },
  // { label: 'Annonsinnehåll', to: '/annonsinnehall' },
  { label: 'Sökandeprofil', to: '/sokandeprofil' },
]

const SiteMenu = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (isMobile) {
    return (
      <PopupState variant="popover" popupId="site-menu-mobile">
        {(popupState) => (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                background: '#fff',
              }}
            >
              <IconButton {...bindTrigger(popupState)} sx={{ padding: 0 }}>
                <MenuIcon />
              </IconButton>
            </Box>
            <Backdrop
              open={popupState.isOpen}
              onClick={popupState.close}
              sx={{ zIndex: 1201 }}
            >
              <Menu
                {...bindMenu(popupState)}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                elevation={0}
                sx={{ top: -16, left: 20 }}
              >
                <IconButton
                  onClick={popupState.close}
                  sx={{ position: 'absolute', top: 5, right: 10 }}
                >
                  <CloseIcon />
                </IconButton>
                {menuItems.map((item) => (
                  <Link key={item.to} to={item.to}>
                    <MenuItem onClick={popupState.close}>
                      <Typography>{item.label}</Typography>
                    </MenuItem>
                  </Link>
                ))}
              </Menu>
            </Backdrop>
          </>
        )}
      </PopupState>
    )
  }

  // Desktop: horisontell meny
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#fff',
      }}
    >
      {menuItems.map((item) => (
        <Button key={item.to} component={Link} to={item.to} color="inherit">
          {item.label}
        </Button>
      ))}
    </Box>
  )
}

export default SiteMenu
