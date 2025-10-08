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
  Collapse,
} from '@mui/material'
import { Contact, Lease, LeaseStatus, PaymentStatus } from '@onecore/types'

import { InvoiceWithRows, useContact } from '../hooks/useContact'
import { useState } from 'react'

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
        <Invoices invoices={contact.invoices} />
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
        {yyyymmdd(new Date(lease.leaseStartDate))}
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
        {lease.leaseEndDate ? yyyymmdd(new Date(lease.leaseEndDate)) : '-'}
      </Grid>
    </Grid>
  ))
}

function Invoices(props: { invoices: InvoiceWithRows[] }) {
  return (
    <Table stickyHeader={true} sx={{ tableLayout: 'fixed' }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturanummer</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturadatum</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Förfallodatum</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Belopp</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Referens</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturatyp</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Betalstatus</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>
            Skickad till inkasso
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from(props.invoices)
          .sort((invoice1, invoice2) =>
            invoice1.invoiceDate < invoice2.invoiceDate ? 1 : -1
          )
          .map((invoice) => (
            <InvoiceTableRow
              key={`${invoice.invoiceId}-${invoice.invoiceDate}`}
              invoice={invoice}
            />
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

function InvoiceTableRow(props: { invoice: InvoiceWithRows }) {
  const { invoice } = props
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          cursor: 'pointer',
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((prev) => !prev)
          }
        }}
        aria-expanded={open}
      >
        <TableCell>{invoice.invoiceId}</TableCell>
        <TableCell>{yyyymmdd(new Date(invoice.invoiceDate))}</TableCell>
        <TableCell>
          {invoice.expirationDate
            ? yyyymmdd(new Date(invoice.expirationDate))
            : '-'}
        </TableCell>
        <TableCell>{invoice.amount}</TableCell>
        <TableCell>{invoice.reference}</TableCell>
        <TableCell>
          {invoice.type === 'Other' ? 'Ströfaktura' : 'Avi'}
        </TableCell>
        <TableCell>
          {invoice.paymentStatus == PaymentStatus.Paid ? 'Betald' : 'Obetald'}
        </TableCell>
        <TableCell>
          {invoice.sentToDebtCollection
            ? new Date(invoice.sentToDebtCollection).toLocaleDateString()
            : '-'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout={0} unmountOnExit>
            <Box margin={1}>
              {invoice.type === 'Other' ? (
                <p>Text: {invoice.description}</p>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Beskrivning
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Belopp</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Moms</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Totalt</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.invoiceRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.invoiceRowText}</TableCell>
                        <TableCell>
                          {row.rowType === 3 ? null : row.amount}
                        </TableCell>
                        <TableCell>
                          {row.rowType === 3 ? null : row.vat}
                        </TableCell>
                        <TableCell>
                          {row.rowType === 3 ? null : row.totalAmount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function yyyymmdd(d: Date) {
  return d.toISOString().split('T')[0]
}
