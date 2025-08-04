import {
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Link,
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
              <TableCell>Utskrift</TableCell>
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
                <TableCell>
                  {materialChoiceStatus.numChoices !== 0 && (
                    <Link
                      href={`/materialval/utskrift?rentalPropertyId=${materialChoiceStatus.apartmentId}`}
                      target="_blank"
                    >
                      <Button>Skriv ut</Button>
                    </Link>
                  )}
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
