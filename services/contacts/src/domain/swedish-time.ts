/**
 * Swedish calendar dates, independent of the process time zone.
 *
 * The service runs in a UTC container, so `new Date()` read with local getters
 * is an hour or two behind Sweden: just after midnight Swedish time it still
 * gives yesterday, and on New Year's Day the previous year. Anything that
 * depends on "today" as a customer or Xpand sees it goes through here, which
 * also makes the result independent of where tests run.
 */
const SWEDISH_TIME_ZONE = 'Europe/Stockholm'

/** sv-SE formats as YYYY-MM-DD. */
const swedishDateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Swedish calendar date of `now` as `YYYY-MM-DD`. */
export const swedishDate = (now: Date): string => swedishDateFormat.format(now)

/** The Swedish calendar year of `now`. */
export const swedishYear = (now: Date): number =>
  Number(swedishDate(now).slice(0, 4))
