import dayjs from 'dayjs'
import Holidays from 'date-holidays'

const hd = new Holidays()
hd.init('SE')

export function addBusinessDays(date: Date, days: number) {
  const holidays = new Set(
    hd
      .getHolidays(new Date().getFullYear())
      .concat(hd.getHolidays(new Date().getFullYear() + 1))
      .filter((h) => h.type === 'public')
      .map((h) => dayjs(h.date).format('YYYY-MM-DD'))
  )

  const [d] = Array.from({
    length: days + Math.floor(days / 5) * 2 + holidays.size + 2,
  })
    .map((_, i) => dayjs(date).add(i + 1, 'day'))
    .filter((d) => d.day() % 6 && !holidays.has(d.format('YYYY-MM-DD')))
    .slice(0, days)
    .reverse()

  return d.toDate()
}
