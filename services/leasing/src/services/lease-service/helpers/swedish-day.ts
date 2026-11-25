// Swedish calendar day as YYYY-MM-DD, so UTC midnight and Swedish midnight give the same date.
// The sv-SE locale formats dates as YYYY-MM-DD, which also makes the result sortable as a string.
export const toSwedishDay = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(
    date
  )
