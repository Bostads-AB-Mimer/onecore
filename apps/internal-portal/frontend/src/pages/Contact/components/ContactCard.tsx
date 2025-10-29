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
  Skeleton,
  Link,
} from '@mui/material'
import { useState } from 'react'
import {
  Contact,
  Invoice,
  Lease,
  LeaseStatus,
  PaymentStatus,
} from '@onecore/types'

import { useContact } from '../hooks/useContact'
import { useInvoicePaymentEvents } from '../hooks/useInvoicePaymentEvents'

const moneyFormatter = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

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

  const invoices = contact.invoices.sort((a, b) =>
    a.invoiceDate < b.invoiceDate ? 1 : -1
  )

  const leases = contact.leases.sort((a, b) => (a.status < b.status ? -1 : 1))

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
        <Leases leases={leases} />
      )}
      <Divider />
      <Typography variant="h2">Fakturor</Typography>
      {!contact.invoices.length ? (
        <Typography fontStyle="italic">Inga fakturor hittades</Typography>
      ) : (
        <Invoices invoices={invoices} />
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

function Invoices(props: { invoices: Invoice[] }) {
  return (
    <Table stickyHeader={true} sx={{ tableLayout: 'fixed' }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturanummer</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturadatum</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Förfallodatum</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Belopp</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Återstående belopp</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Fakturatyp</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Betalstatus</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Inkasso</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Källa</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {props.invoices.map((invoice) => (
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

function InvoiceTableRow(props: { invoice: Invoice }) {
  const { invoice } = props
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          cursor: 'pointer',
          backgroundColor: open ? 'rgba(0, 0, 0, 0.04)' : 'inherit',
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
        <TableCell>{moneyFormatter.format(invoice.amount)}</TableCell>
        <TableCell>
          {invoice.remainingAmount
            ? moneyFormatter.format(invoice.remainingAmount)
            : '-'}
        </TableCell>
        <TableCell>
          {invoice.type === 'Other' ? 'Ströfaktura' : 'Avi'}
        </TableCell>
        <TableCell>
          {invoice.paymentStatus == PaymentStatus.Paid ? 'Betald' : 'Obetald'}
        </TableCell>
        <TableCell>
          {invoice.sentToDebtCollection
            ? new Date(invoice.sentToDebtCollection).toLocaleDateString()
            : 'Nej'}
        </TableCell>
        <TableCell>
          {invoice.source === 'legacy' ? 'xpand' : 'xledger'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse
            in={open}
            timeout={0}
            unmountOnExit
            sx={{ backgroundColor: open ? 'rgba(0, 0, 0, 0.04)' : 'inherit' }}
          >
            <InvoiceDetails invoice={invoice} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function InvoiceDetails(props: { invoice: Invoice }) {
  const { invoice } = props

  if (invoice.type === 'Other') {
    return (
      <Box>
        <Typography>Text: {invoice.description}</Typography>
        {invoice.invoiceFileUrl && (
          <Link target="_blank" href={invoice.invoiceFileUrl}>
            Länk till faktura
          </Link>
        )}
      </Box>
    )
  }

  const renderInvoiceRows = () => {
    if (!invoice.invoiceRows.length) {
      return (
        <TableRow>
          <TableCell colSpan={9}>
            <Typography fontStyle="italic">
              Inga fakturarader hittades
            </Typography>
          </TableCell>
        </TableRow>
      )
    }

    return invoice.invoiceRows.map((row, index) => (
      <TableRow key={index}>
        <TableCell colSpan={2}>{row.invoiceRowText}</TableCell>
        <TableCell>
          {row.rowType === 3 ? null : moneyFormatter.format(row.amount)}
        </TableCell>
        <TableCell>
          {row.rowType === 3 ? null : moneyFormatter.format(row.deduction)}
        </TableCell>
        <TableCell>
          {row.rowType === 3 ? null : moneyFormatter.format(row.vat)}
        </TableCell>
        <TableCell>
          {row.rowType === 3 ? null : moneyFormatter.format(row.totalAmount)}
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <Box padding={2}>
      <Typography variant="h2" sx={{ mt: 1, mb: 1, fontSize: 18 }}>
        Fakturarader
      </Typography>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }} colSpan={2}>
              Beskrivning
            </TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Belopp</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Avdrag</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Moms</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Totalt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{renderInvoiceRows()}</TableBody>
      </Table>
      {invoice.source === 'next' && (
        <>
          <Typography variant="h2" sx={{ mt: 2, mb: 1, fontSize: 18 }}>
            Betalningshändelser
          </Typography>
          <InvoicePaymentEvents invoiceId={invoice.invoiceId} />
        </>
      )}
    </Box>
  )
}

function InvoicePaymentEvents(props: { invoiceId: string }) {
  const eventsQuery = useInvoicePaymentEvents(props.invoiceId)

  const render = () => {
    if (eventsQuery.isLoading) {
      return (
        <TableRow>
          <TableCell>
            <Skeleton variant="text" width="40%" height="25px" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="30%" height="25px" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="30%" height="25px" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="30%" height="25px" />
          </TableCell>
        </TableRow>
      )
    }

    if (eventsQuery.error) {
      return (
        <TableRow>
          <TableCell>
            <Typography fontStyle="italic">
              {eventsQuery.error.status === 404
                ? 'Inga betalningshändelser hittades'
                : 'Ett fel uppstod när betalningshändelser hämtades'}
            </Typography>
          </TableCell>
        </TableRow>
      )
    }

    if (eventsQuery.data?.length) {
      return eventsQuery.data.map((event, index) => (
        <TableRow key={index}>
          <TableCell>{event.transactionSourceCode}</TableCell>
          <TableCell>{moneyFormatter.format(event.amount)}</TableCell>
          <TableCell>{event.text}</TableCell>
          <TableCell>{yyyymmdd(new Date(event.paymentDate))}</TableCell>
        </TableRow>
      ))
    }

    return (
      <TableRow>
        <TableCell>
          <Typography fontStyle="italic">
            Inga betalningshändelser hittades
          </Typography>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Table size="small" sx={{ tableLayout: 'fixed' }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'inherit' }}>
            Källa
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'inherit' }}>
            Belopp
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'inherit' }}>
            Text
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'inherit' }}>
            Betaldatum
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>{render()}</TableBody>
    </Table>
  )
}

function yyyymmdd(d: Date) {
  return d.toISOString().split('T')[0]
}
