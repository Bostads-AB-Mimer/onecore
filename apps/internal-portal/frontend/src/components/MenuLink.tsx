import { Box } from '@mui/material'
import { Link } from 'react-router-dom'
const MenuLink = ({ href, title }: { href: string; title: string }) => (
  <Link to={href}>
    <Box sx={{ fontSize: 14, fontFamily: 'graphikRegular', color: '#000' }}>
      {title}
    </Box>
  </Link>
)
export default MenuLink
