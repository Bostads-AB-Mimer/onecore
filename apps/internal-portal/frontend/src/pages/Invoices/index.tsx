import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material'
import { Invoice, PaymentStatus } from '@onecore/types'
import { useUnpaidInvoices } from './hooks/useUnpaidInvoices'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  }).format(amount)
}

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('sv-SE')
}

const getPaymentStatusColor = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.Paid:
      return 'success'
    case PaymentStatus.Unpaid:
      return 'error'
    default:
      return 'default'
  }
}

const getPaymentStatusText = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.Paid:
      return 'Betald'
    case PaymentStatus.Unpaid:
      return 'Obetald'
    default:
      return 'Okänd'
  }
}

const InvoicesTable = ({ invoices }: { invoices: Invoice[] }) => {
  return (
    <TableContainer
      component={Paper}
      style={{ paddingLeft: 10, paddingRight: 10 }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Faktura ID</TableCell>
            <TableCell>Referens</TableCell>
            <TableCell>Belopp</TableCell>
            <TableCell>Fakturadatum</TableCell>
            <TableCell>Förfallodatum</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Typ</TableCell>
            <TableCell>Beskrivning</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.invoiceId}>
              <TableCell>{invoice.invoiceId}</TableCell>
              <TableCell>{invoice.reference}</TableCell>
              <TableCell>{formatCurrency(invoice.amount)}</TableCell>
              <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
              <TableCell>
                {invoice.expirationDate
                  ? formatDate(invoice.expirationDate)
                  : '-'}
              </TableCell>
              <TableCell>
                <Chip
                  label={getPaymentStatusText(invoice.paymentStatus)}
                  color={getPaymentStatusColor(invoice.paymentStatus)}
                  size="small"
                />
              </TableCell>
              <TableCell>{invoice.type}</TableCell>
              <TableCell>{invoice.description || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function Invoices() {
  const query = useUnpaidInvoices()

  if (query.isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (query.isError) {
    return (
      <Box mt={4}>
        <Typography color="error">
          Ett fel uppstod när fakturor skulle hämtas
        </Typography>
      </Box>
    )
  }

  if (!query.data?.content) {
    return (
      <Box mt={4}>
        <Typography>Inga fakturor hittades</Typography>
      </Box>
    )
  }

  const invoices = query.data.content

  return (
    <Box>
      <Typography variant="h2" gutterBottom>
        Obetalda fakturor
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Totalt {invoices.length} obetalda fakturor
      </Typography>
      <Box mt={3}>
        <InvoicesTable invoices={invoices} />
      </Box>
    </Box>
  )
}
