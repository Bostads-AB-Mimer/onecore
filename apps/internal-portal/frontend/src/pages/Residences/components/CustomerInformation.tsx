// TODO: rename this file to ContactInformationForm.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import React from 'react'

type ContactInformationFormProps = {
  fullName?: string
  nationalRegistrationNumber?: string
  contactCode?: string
  phoneNumber?: string
}

const ContactInformationForm = ({
  fullName,
  nationalRegistrationNumber,
  contactCode,
  phoneNumber,
}: ContactInformationFormProps) => (
  <React.Fragment>
    <Typography variant="h1">Kundinformation</Typography>
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>Namn</TableCell>
          <TableCell align="right">{fullName}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Personnummer</TableCell>
          <TableCell align="right">{nationalRegistrationNumber}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Kundnummer</TableCell>
          <TableCell align="right">{contactCode}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Telefonnummer</TableCell>
          <TableCell align="right">{phoneNumber}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </React.Fragment>
)

export default ContactInformationForm
