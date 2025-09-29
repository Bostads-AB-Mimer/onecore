import {
  Box,
  Typography,
  Divider,
  Grid,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  CircularProgress,
} from '@mui/material'
import {
  Contact,
  Invoice,
  Lease,
  LeaseStatus,
  PaymentStatus,
} from '@onecore/types'

import { useContact } from '../hooks/useContact'

export function ContactCard(props: { contactCode: string }) {
  const query = useContact(props.contactCode)

  if (query.isLoading) {
    return <CircularProgress />
  }

  if (query.isError) {
    return 'error'
  }

  if (!query.data) {
    return 'invariant, no data'
  }

  const { data: contact } = query

  return (
    <Box>
      <Typography variant="h2" fontSize={24}>
        {contact.fullName}
      </Typography>
      <Divider />
      <Typography variant="h2">Basinformation</Typography>
      <ContactInfo contact={contact} />
      <Divider />
      <Typography variant="h2">Kontrakt</Typography>
      {!contact.leases?.length ? (
        <Typography fontStyle="italic">Inga kontrakt hittades</Typography>
      ) : (
        <Leases
          leases={contact.leases.sort((a, b) => (a.status < b.status ? -1 : 1))}
        />
      )}
      <Divider />
      <Typography variant="h2">Fakturor</Typography>
      {!contact.invoices.length ? (
        <Typography fontStyle="italic">Inga fakturor hittades</Typography>
      ) : (
        <>
          <Invoices invoices={contact.invoices} />
        </>
      )}
      <Divider />
    </Box>
  )
}

function ContactInfo(props: { contact: Contact }) {
  return (
    <Grid container sx={{ marginTop: 1 }}>
      <Grid item xs={12} md={4} lg={2} sx={{ marginBottom: 2 }}>
        <b>Kontaktkod</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4} sx={{ marginBottom: 2 }}>
        {props.contact.contactCode}
      </Grid>
      <Grid item xs={12} md={4} lg={2} sx={{ marginBottom: 2 }}>
        <b>Personnummer</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4} sx={{ marginBottom: 2 }}>
        {props.contact.nationalRegistrationNumber}
      </Grid>
      <Grid item xs={12} md={4} lg={2} sx={{ marginBottom: 2 }}>
        <b>Adress</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4} sx={{ marginBottom: 2 }}>
        {props.contact.address?.street} {props.contact.address?.number}
        <br />
        {props.contact.address?.postalCode}
        <br />
        {props.contact.address?.city}
        <br />
      </Grid>
    </Grid>
  )
}

function Leases(props: { leases: Lease[] }) {
  return props.leases.map((lease) => (
    <Grid container sx={{ marginTop: 1 }} key={lease.leaseId}>
      <Grid item xs={12} key={lease.leaseId}>
        {
          <Typography variant="h3" marginBottom="1rem">
            {lease.leaseId} ({getStatusName(lease.status)})
          </Typography>
        }
      </Grid>
      <Grid item xs={12} md={4} lg={2}>
        <b>Typ</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4}>
        {lease.type}
      </Grid>
      <Grid item xs={12} md={4} lg={2}>
        <b>Startdatum</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4}>
        {new Date(lease.leaseStartDate).toISOString() ?? '-'}
      </Grid>
      <Grid item xs={12} md={4} lg={2}>
        <b>Adress</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4}>
        {lease.address?.street}
      </Grid>
      <Grid item xs={12} md={4} lg={2}>
        <b>Slutdatum</b>
      </Grid>
      <Grid item xs={12} md={8} lg={4}>
        {lease.leaseEndDate
          ? new Date(lease.leaseStartDate).toISOString()
          : '-'}
      </Grid>
    </Grid>
  ))
}

function Invoices(props: { invoices: Invoice[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturadatum</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Förfallodatum</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturanummer</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Belopp</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Betalstatus</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {props.invoices
          .sort((invoice1, invoice2) => {
            return invoice1.invoiceDate < invoice2.invoiceDate ? 1 : -1
          })
          .map((invoice) => (
            <TableRow key={`${invoice.invoiceId}-${invoice.invoiceDate}`}>
              <TableCell>
                {new Date(invoice.invoiceDate).toString().substring(0, 10)}
              </TableCell>
              <TableCell>
                {new Date(invoice.expirationDate).toString().substring(0, 10)}
              </TableCell>
              <TableCell>{invoice.invoiceId}</TableCell>
              <TableCell>{invoice.amount}</TableCell>
              <TableCell>
                {invoice.paymentStatus == PaymentStatus.Paid
                  ? 'Betald'
                  : 'Obetald'}
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}

function getStatusName(status: LeaseStatus) {
  switch (status) {
    case LeaseStatus.Current:
      return 'Aktivt'
    case LeaseStatus.Upcoming:
      return 'Kommande'
    case LeaseStatus.AboutToEnd:
      return 'Uppsagt'
    case LeaseStatus.Ended:
      return 'Avslutat'
    default:
      return 'Okänt'
  }
}
