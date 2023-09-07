import { ArrowForwardOutlined, DoneOutlined } from '@mui/icons-material';
import { Typography } from '@mui/material';

const Progress = () => (
  <div>
    <Typography variant="h1">Saker att tänka på</Typography>
    <ul>
      <li>
        <DoneOutlined></DoneOutlined> Ombyggnation startar
      </li>
      <li>
        <DoneOutlined></DoneOutlined> Bidra genom att rösta!
      </li>
      <li>
        <ArrowForwardOutlined></ArrowForwardOutlined> Gör materialval senaste 31
        maj
      </li>
    </ul>
  </div>
);
export default Progress;
