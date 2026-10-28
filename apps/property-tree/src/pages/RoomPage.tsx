import { Navigate, useParams } from 'react-router-dom'

import { paths } from '@/shared/routes'

export const RoomPage = () => {
  const { rentalId = '', roomCode = '' } = useParams()
  return <Navigate replace to={paths.room(rentalId, roomCode)} />
}
