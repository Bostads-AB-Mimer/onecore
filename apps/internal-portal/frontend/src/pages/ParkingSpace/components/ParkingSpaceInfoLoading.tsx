import { Box, Skeleton } from '@mui/material'

export const ParkingSpaceInfoLoading = () => (
  <Box display="flex" flex="1" justifyContent="space-between" gap="4rem">
    <Box
      display="flex"
      flex="0.5"
      flexDirection="column"
      gap="1rem"
      paddingTop="2rem"
    >
      <Skeleton variant="rectangular" height={60} />
      <Skeleton variant="rectangular" height={60} />
      <Skeleton variant="rectangular" height={60} />
      <Skeleton variant="rectangular" height={60} />
    </Box>

    <Box
      display="flex"
      flex="1"
      flexDirection="column"
      gap="1rem"
      paddingTop="2rem"
    >
      <Skeleton variant="rectangular" height={'100%'} />
    </Box>
  </Box>
)
