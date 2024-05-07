import { Box, Skeleton } from '@mui/material'

export const ApplicantsLoading = () => (
  <Box
    display="flex"
    flex="0.5"
    flexDirection="column"
    gap="1rem"
    paddingTop="2rem"
  >
    <Skeleton variant="rectangular" width="50%" height={45} />
    <Skeleton sx={{ marginTop: '2rem' }} variant="rectangular" height={60} />
    <Skeleton variant="rectangular" height={60} />
    <Skeleton variant="rectangular" height={60} />
    <Skeleton variant="rectangular" height={60} />
  </Box>
)
