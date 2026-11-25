export const formatRentalType = (rentalType: string) => {
  // Remove " hyresobjektstyp" suffix if present ("Standard hyresobjektstyp" -> "Standard")
  return rentalType.replace(/ hyresobjektstyp$/i, '').trim()
}

export const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  // Swedish calendar day regardless of the browser's timezone, matching the
  // backend's created-date filter
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

export const formatCurrency = (amount: number, maximumFractionDigits = 0) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits,
  }).format(amount)
}

export const formatAddress = (address: string) => {
  if (!address) return ''
  // Capitalize only the first letter, rest lowercase
  return address.charAt(0).toUpperCase() + address.slice(1).toLowerCase()
}
