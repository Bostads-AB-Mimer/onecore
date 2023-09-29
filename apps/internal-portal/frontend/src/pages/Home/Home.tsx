import {
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material'
import { useProfile, Account } from '../../common/hooks/useProfile'
import { useApartmentMaterialChoices } from './hooks/useApartmentMaterialChoices'

const HomePage = () => {
  const { data: profile, isLoading: isProfileLoading } = useProfile()
  const { data: apartmentMaterialChoices, isLoading: isChoicesLoading } =
    useApartmentMaterialChoices()

  const account = profile?.account as Account

  return (
    <div>
      <Typography variant="title">
        Välkommen {isProfileLoading ? '' : account?.name}!
      </Typography>
      <Typography variant="h2">Projektstatus materialval</Typography>
      {!isChoicesLoading && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Lägenhetsid</TableCell>
              <TableCell>Status materialval</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apartmentMaterialChoices?.map((materialChoiceStatus) => (
              <TableRow key="{materialChoiceStatus.apartmentId}">
                <TableCell>{materialChoiceStatus.apartmentId}</TableCell>
                <TableCell>
                  {materialChoiceStatus.numChoices === 0
                    ? 'Väntar på val'
                    : 'Val genomfört'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Table></Table>
    </div>
  )
}

export default HomePage
