import { Stack } from '@mui/material'
import { Link } from 'react-router-dom'

import mimerLogo from '@libs/assets/images/mimer-logo.png'
import SiteMenu from './SiteMenu'

const SiteHeader = () => (
  <Stack
    sx={{ marginTop: 2, marginBottom: 1 }}
    direction="row"
    justifyContent="space-between"
    alignItems="center"
  >
    <a href="https://onecore.mimer.nu">
      <img src={mimerLogo} width="160" alt="Mimer logotyp" />
    </a>

    <SiteMenu />
  </Stack>
)

export default SiteHeader
