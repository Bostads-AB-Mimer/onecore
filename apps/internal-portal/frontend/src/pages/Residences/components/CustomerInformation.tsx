import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import React from 'react'

type CustomerInformationFormProps = {
  name: string
  socialSecurityNumber: string
  customerNumber: string
  phoneNumber: string
}

const CustomerInformationForm = ({
  name,
  socialSecurityNumber,
  customerNumber,
  phoneNumber,
}: CustomerInformationFormProps) => (
  <>
    <Typography variant="h1">Kundinformation</Typography>
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>Namn</TableCell>
          <TableCell align="right">{name}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Personnummer</TableCell>
          <TableCell align="right">{socialSecurityNumber}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Kundnummer</TableCell>
          <TableCell align="right">{customerNumber}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Telefonnummer</TableCell>
          <TableCell align="right">{phoneNumber}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </>
)

export default CustomerInformationForm
