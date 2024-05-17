import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'

type Props = { to: string; text: string }

export const PageGoBackTo = (props: Props) => (
  <Link to={props.to}>
    <Box display="flex" alignItems="center" paddingTop="1rem" gap="0.25rem">
      <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
      <Typography variant="h2" paddingTop="0">
        {props.text}
      </Typography>
    </Box>
  </Link>
)
