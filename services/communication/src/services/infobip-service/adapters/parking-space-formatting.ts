// Value formatting for system email placeholders (email-adapter.ts builders).

export const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'UTC',
})

export const formatToSwedishCurrency = (numberStr: string) => {
  const number = parseFloat(numberStr)

  if (isNaN(number)) {
    return '0 kr'
  }

  const formattedNumber = new Intl.NumberFormat('sv-SE', {
    //render max 2 decimals if there are decimals, otherwise render 0 decimals
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
  }).format(number)

  return formattedNumber + ' kr'
}

export const getParkingSpaceImageUrl = (rentalObjectCode: string) => {
  const identifier = rentalObjectCode.slice(0, 7)
  return `https://pub.mimer.nu/bofaktablad/mediabank/Bilplatser/${identifier}.jpg`
}
