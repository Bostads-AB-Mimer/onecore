import { Table, TableBody, TableCell, TableRow } from '@mui/material'
import React from 'react'

type CustomerReferenceFormProps = {
  customerReferenceReceivedAt: string
  housingReferenceUpdatedAt: string
  updatedBy: string
  validUntil?: string
}

const CustomerReferenceForm = ({
  customerReferenceReceivedAt,
  housingReferenceUpdatedAt,
  updatedBy,
  validUntil,
}: CustomerReferenceFormProps) => (
  <Table>
    <TableBody>
      <TableRow>
        <TableCell>Referensuppgifter från kund</TableCell>
        <TableCell align="right">{customerReferenceReceivedAt}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell>Boendereferens hanterad/uppdaterad</TableCell>
        <TableCell align="right">{housingReferenceUpdatedAt}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell>Senast uppdaterad av</TableCell>
        <TableCell align="right">{updatedBy}</TableCell>
      </TableRow>

      {validUntil && (
        <TableRow>
          <TableCell>Giltig till</TableCell>
          <TableCell align="right">{validUntil}</TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
)

export default CustomerReferenceForm
