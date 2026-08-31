export const formatRentalType = (rentalType: string) => {
  // Remove " hyresobjektstyp" suffix if present ("Standard hyresobjektstyp" -> "Standard")
  return rentalType.replace(/ hyresobjektstyp$/i, '').trim()
}

export const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('sv-SE')
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatAddress = (address: string) => {
  if (!address) return ''
  // Capitalize only the first letter, rest lowercase
  return address.charAt(0).toUpperCase() + address.slice(1).toLowerCase()
}
