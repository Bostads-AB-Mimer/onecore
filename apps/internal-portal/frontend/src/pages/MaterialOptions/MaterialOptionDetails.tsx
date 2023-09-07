import { Box, Divider, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'

import { useMaterialOptionDetails } from './hooks/useMaterialOptions'

const MaterialOptionDetails = () => {
  const { roomTypeId, materialOptionGroupId, materialOptionId } = useParams()
  const navigate = useNavigate()

  const materialOption = useMaterialOptionDetails({
    roomTypeId,
    materialOptionGroupId,
    materialOptionId,
  })?.data?.data.materialOption

  return (
    <>
      <Link to={'..'}>&lt; Materialval</Link>
      <Typography variant="h2">{materialOption?.roomTypeName}</Typography>
      <Typography variant="h1">{materialOption?.caption}</Typography>
      <Box sx={styles.infoBox}>
        <Typography variant="body2">
          Kom ihåg! Färgåtergivning på bilder av material och väggfärger kan
          variera beroende på dina skärminställningar. För exakta färger
          hänvisar vi till vår utställning.
        </Typography>
      </Box>
      <Divider />

      {materialOption?.images && materialOption.images[0] && (
        <Box sx={styles.imageBox}>
          <img
            src={'/api/material-options/assets/' + materialOption.images[0]}
            alt={materialOption.caption}
            width="85%"
          />
        </Box>
      )}

      <Typography variant="body1">{materialOption?.description}</Typography>

      {materialOption?.images?.map((image, index) => {
        if (index > 0) {
          return (
            <Box key={index} sx={styles.imageBox}>
              <img
                src={'/api/material-options/assets/' + image}
                alt=""
                width="85%"
              />
            </Box>
          )
        }
      })}
    </>
  )
}

const styles = {
  infoBox: {
    backgroundColor: '#F4EFE9',
    marginTop: 2,
    marginBottom: 1,
    padding: 1,
  },
  imageBox: {
    marginTop: 2.5,
    marginBottom: 1.5,
  },
}

export default MaterialOptionDetails
