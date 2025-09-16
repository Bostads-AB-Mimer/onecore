import { Grid } from '@mui/material'
import { useState } from 'react'

import { SearchBar } from '../../components'
import { useInvoicesByContactCode } from './hooks/useInvoicesByContactCode'

export function Invoices() {
  const [contactCode, setContactCode] = useState<string>('')
  const contactsQuery = useInvoicesByContactCode(contactCode)

  const onSearchChange = (v: string) => {
    console.log(v)
  }

  return (
    <Grid container columnSpacing={4}>
      <Grid item xs={6}>
        <SearchBar
          placeholder="Sök på fakturanummer, kundnummer"
          onChange={onSearchChange}
        />
      </Grid>
    </Grid>
  )
}
