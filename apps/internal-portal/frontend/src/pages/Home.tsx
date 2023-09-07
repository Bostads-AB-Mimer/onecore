import { Card, CardActions, CardContent, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'

import materialChoiceCover from '../../assets/images/Materialval.png'
import Carousel from '../components/Carousel'
import { useLease } from '../pages/Lease/hooks/useLease'

const HomePage = () => {
  const { data } = useLease()
  const lease = data?.data

  return (
    <div>
      <Typography variant="title">Välkommen!</Typography>
      <Typography variant="body1">
        Det här är mina sidor för ombyggnationen i området Gryta
      </Typography>

      <Typography variant="h2">Aktuellt</Typography>

      <Carousel
        links={[{ link: '/materialval', image: materialChoiceCover }]}
      ></Carousel>

      <Card variant="outlined">
        <Typography variant="h2">
          <HomeWorkOutlinedIcon sx={{ marginRight: 0.5, marginLeft: 1.5 }} />{' '}
          Mitt boende
        </Typography>
        <CardContent>
          <Typography variant="body2">
            {lease?.leaseId}
            <br />
            {lease?.rentalProperty?.address?.street +
              ' ' +
              lease?.rentalProperty?.address?.number}
          </Typography>
        </CardContent>
        <CardActions>
          <Link to="/mitt-boende">Läs mer...</Link>
        </CardActions>
      </Card>
    </div>
  )
}

export default HomePage
