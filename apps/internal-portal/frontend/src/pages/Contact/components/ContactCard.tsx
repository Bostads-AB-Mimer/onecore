import { Box, Typography, Divider, Grid } from '@mui/material'
import { LeaseStatus, PaymentStatus } from '@onecore/types'

import { useContact } from '../hooks/useContact'

export function ContactCard(props: { contactCode: string }) {
  const query = useContact(props.contactCode)

  if (query.isLoading) {
    return 'loading'
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
      <>
        <Typography variant="h2" fontSize={24}>
          {contact.fullName}
        </Typography>
        <Divider />
        <Typography variant="h2">Basinformation</Typography>
        <>
          <Grid container sx={{ marginLeft: 1, marginTop: 1 }}>
            <Grid item xs={12} md={4} lg={2} sx={{ marginBottom: 2 }}>
              <b>Kontaktkod</b>
            </Grid>
            <Grid item xs={12} md={8} lg={4} sx={{ marginBottom: 2 }}>
              {contact.contactCode}
            </Grid>
            <Grid item xs={12} md={4} lg={2} sx={{ marginBottom: 2 }}>
              <b>Personnummer</b>
            </Grid>
            <Grid item xs={12} md={8} lg={4} sx={{ marginBottom: 2 }}>
              {contact.nationalRegistrationNumber}
            </Grid>
            <Grid item xs={12} md={4} lg={2} sx={{ marginBottom: 2 }}>
              <b>Adress</b>
            </Grid>
            <Grid item xs={12} md={8} lg={4} sx={{ marginBottom: 2 }}>
              {contact.address?.street} {contact.address?.number}
              <br />
              {contact.address?.postalCode}
              <br />
              {contact.address?.city}
              <br />
            </Grid>
          </Grid>
          {contact.leases && (
            <>
              <Divider />
              <Typography variant="h2">Kontrakt</Typography>
              {contact.leases
                ?.sort((lease1, lease2) => {
                  return lease1.status < lease2.status ? -1 : 1
                })
                .map((lease) => (
                  <Grid
                    container
                    sx={{ marginLeft: 1, marginTop: 1 }}
                    key={lease.leaseId}
                  >
                    <Grid item xs={12} key={lease.leaseId}>
                      {
                        <Typography variant="h3">
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
                      {lease.leaseStartDate.toString().substring(0, 10)}
                    </Grid>
                    <Grid item xs={12} md={4} lg={2}>
                      <b>Slutdatum</b>
                    </Grid>
                    <Grid item xs={12} md={8} lg={4}>
                      {lease.leaseEndDate?.toString()}
                    </Grid>
                    <Grid item xs={12} md={4} lg={2}>
                      <b>Adress</b>
                    </Grid>
                    <Grid item xs={12} md={8} lg={4}>
                      {lease.address?.street}
                    </Grid>
                    <Grid item xs={12} md={4} lg={2}>
                      <b>Startdatum</b>
                    </Grid>
                    <Grid item xs={12} md={8} lg={4}>
                      {lease.rentalProperty?.address?.street.toString()}
                    </Grid>
                  </Grid>
                ))}
            </>
          )}

          {contact.invoices.length > 0 ? (
            <>
              <Divider />
              <Typography variant="h2">Fakturor</Typography>
              <Grid container>
                <Grid item xs={2}>
                  <b>Fakturadatum</b>
                </Grid>
                <Grid item xs={2}>
                  <b>Förfallodatum</b>
                </Grid>
                <Grid item xs={3}>
                  <b>Fakturanummer</b>
                </Grid>
                <Grid item xs={3}>
                  <b>Belopp</b>
                </Grid>
                <Grid item xs={2}>
                  <b>Betalstatus</b>
                </Grid>
              </Grid>
              {contact.invoices
                .sort((invoice1, invoice2) => {
                  return invoice1.fromDate < invoice2.fromDate ? 1 : -1
                })
                .map((invoice) => (
                  <Grid
                    container
                    sx={{ marginLeft: 1, marginTop: 1 }}
                    key={invoice.invoiceId}
                  >
                    <Grid item xs={2}>
                      {new Date(invoice.invoiceDate)
                        .toString()
                        .substring(0, 10)}
                    </Grid>
                    <Grid item xs={2}>
                      {new Date(invoice.expirationDate)
                        .toString()
                        .substring(0, 10)}
                    </Grid>
                    <Grid item xs={3}>
                      {invoice.invoiceId}
                    </Grid>
                    <Grid item xs={3}>
                      {invoice.amount}
                    </Grid>
                    <Grid item xs={2}>
                      {invoice.paymentStatus == PaymentStatus.Paid
                        ? 'Betald'
                        : 'Obetald'}
                    </Grid>
                  </Grid>
                ))}
            </>
          ) : null}
          <Divider />
        </>
      </>
    </Box>
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
