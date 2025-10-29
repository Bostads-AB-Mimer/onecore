import { IconButton, MenuItem, Menu, Typography, Backdrop } from '@mui/material'
import PopupState, { bindTrigger, bindMenu } from 'material-ui-popup-state'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import { Link } from 'react-router-dom'

const SiteMenu = () => (
  <PopupState variant="popover" popupId="demo-popup-menu">
    {(popupState) => (
      <>
        <IconButton {...bindTrigger(popupState)} sx={{ padding: 0 }}>
          <MenuIcon />
        </IconButton>

        <Backdrop open={popupState.isOpen} onClick={popupState.close}>
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

            <MenuItem
              onClick={popupState.close}
              sx={{ width: '200px' }}
              disabled
            >
              <Typography variant="h1">OneCore</Typography>
            </MenuItem>
            <Link to="https://onecore.mimer.nu">
              <MenuItem onClick={popupState.close}>
                <Typography>OneCore startsida</Typography>
              </MenuItem>
            </Link>
            <Link to="/bilplatser">
              <MenuItem onClick={popupState.close}>
                <Typography>Bilplatser</Typography>
              </MenuItem>
            </Link>
            <Link to="/bilplatser/publicera">
              <MenuItem onClick={popupState.close}>
                <Typography>Publicera bilplatser</Typography>
              </MenuItem>
            </Link>
            <Link to="/sok-bilplats">
              <MenuItem onClick={popupState.close}>
                <Typography>Sök bilplats</Typography>
              </MenuItem>
            </Link>
            {/* 
            <Link to="/materialval">
              <MenuItem onClick={popupState.close}>
                <Typography>Materialval</Typography>
              </MenuItem>
            </Link> */}

            <Link to="/sokandeprofil">
              <MenuItem onClick={popupState.close}>
                <Typography>Sökandeprofil</Typography>
              </MenuItem>
            </Link>
            <Link to="/kundkort">
              <MenuItem onClick={popupState.close}>
                <Typography>Kundkort</Typography>
              </MenuItem>
            </Link>
          </Menu>
        </Backdrop>
      </>
    )}
  </PopupState>
)

export default SiteMenu
