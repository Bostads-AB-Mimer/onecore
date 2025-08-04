import { Table, TableBody, TableCell, TableRow } from '@mui/material'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

const FormattedDateOrDash = ({ date }: { date: Date | null | undefined }) =>
  date ? <span>{dayjs(date).format('YYYY-MM-DD')}</span> : <span>-</span>

type CustomerReferenceFormProps = {
  customerReferenceReceivedAt?: Date | null
  housingReferenceUpdatedAt?: Date | null
  updatedBy?: string | null
  expiresAt?: Date | null
}

const CustomerReferenceForm = ({
  customerReferenceReceivedAt,
  housingReferenceUpdatedAt,
  updatedBy,
  expiresAt,
}: CustomerReferenceFormProps) => {
  const {
    setError,
    clearErrors,
    formState: { errors },
  } = useForm()

  useEffect(() => {
    if (
      customerReferenceReceivedAt &&
      housingReferenceUpdatedAt &&
      new Date(customerReferenceReceivedAt) >
        new Date(housingReferenceUpdatedAt)
    ) {
      setError('dates', {
        type: 'manual',
        message: 'Obs! boendereferenserna har ändrats efter godkännandedatum',
      })
    } else {
      clearErrors('dates')
    }
  }, [
    customerReferenceReceivedAt,
    housingReferenceUpdatedAt,
    setError,
    clearErrors,
  ])

  return (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>Referensuppgifter från kund</TableCell>
          <TableCell align="right">
            <FormattedDateOrDash date={customerReferenceReceivedAt} />
            {typeof errors.dates?.message === 'string' && errors.dates && (
              <div style={{ color: 'red' }}>{errors.dates.message}</div>
            )}
          </TableCell>
        </TableRow>

        <TableRow>
          <TableCell>Boendereferens hanterad/uppdaterad</TableCell>
          <TableCell align="right">
            <FormattedDateOrDash date={housingReferenceUpdatedAt} />
          </TableCell>
        </TableRow>

        <TableRow>
          <TableCell>Senast uppdaterad av</TableCell>
          <TableCell align="right">{updatedBy}</TableCell>
        </TableRow>

        {expiresAt && (
          <TableRow>
            <TableCell>Giltig till</TableCell>
            <TableCell align="right">
              <FormattedDateOrDash date={expiresAt} />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export default CustomerReferenceForm
