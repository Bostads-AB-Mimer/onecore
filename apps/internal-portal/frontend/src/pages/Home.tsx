import { Card, CardActions, CardContent, Typography, Link } from '@mui/material'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'

import materialChoiceCover from '../../assets/images/Materialval.png'
import Carousel from '../components/Carousel'
import { useProfile, Account } from '../common/hooks/useProfile'

const HomePage = () => {
  const { data } = useProfile()
  const account = data?.account as Account

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
          {account?.name}
        </Typography>
        <CardContent>
          {account?.username}
          <br />
        </CardContent>
        <CardActions>
          <Link href="/api/auth/logout">Logga ut</Link>
        </CardActions>
      </Card>
    </div>
  )
}

export default HomePage
