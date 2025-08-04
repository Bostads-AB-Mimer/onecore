import { Stack } from '@mui/material'
import { Link } from 'react-router-dom'

import mimerLogo from '../../assets/mimer-logo.png'
import SiteMenu from './SiteMenu'

const SiteHeader = () => (
  <Stack
    sx={{ marginTop: 2, marginBottom: 1 }}
    direction="row"
    justifyContent="space-between"
    alignItems="center"
  >
    <Link to={'/'}>
      <img src={mimerLogo} width="160" alt="Mimer logotyp" />
    </Link>

    <SiteMenu />
  </Stack>
)

export default SiteHeader
