import { Box, Typography } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'

type Props = { text: string }

export const PageGoBack = (props: Props) => {
  const navigate = useNavigate()

  return (
    <Link to="#" onClick={() => navigate(-1)}>
      <Box display="flex" alignItems="center" paddingTop="1rem" gap="0.25rem">
        <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        <Typography variant="h2" paddingTop="0">
          {props.text}
        </Typography>
      </Box>
    </Link>
  )
}
