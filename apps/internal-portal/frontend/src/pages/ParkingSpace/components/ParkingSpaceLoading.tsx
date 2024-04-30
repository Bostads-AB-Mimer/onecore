import { Box, Skeleton } from '@mui/material'

export const ParkingSpaceLoading = () => (
  <Box display="flex" flexDirection="column" gap="1rem" paddingTop="2rem">
    <Skeleton variant="rectangular" width="50%" height={60} />
    <Skeleton variant="rectangular" width="50%" height={60} />
    <Skeleton variant="rectangular" width="50%" height={60} />
  </Box>
)
