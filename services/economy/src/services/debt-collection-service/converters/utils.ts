export const joinStrings = (strings: string[], separator = '') =>
  strings.join(separator)

export const leftPad = (
  value: string | number,
  length: number,
  padChar: string
) => {
  if (padChar.length != 1) {
    throw new Error('padChar must be a single character')
  }

  return value.toString().substring(0, length).padStart(length, padChar)
}

export const rightPad = (
  value: string | number,
  length: number,
  padChar: string
) => {
  if (padChar.length != 1) {
    throw new Error('padChar must be a single character')
  }

  return value.toString().substring(0, length).padEnd(length, padChar)
}

export const getYearString = (date: Date) => {
  return date.getFullYear().toString().slice(2, 4)
}

export const getMonthString = (date: Date) => {
  const month = date.getMonth() + 1
  return month < 10 ? `0${month}` : month
}

export const getDayString = (date: Date) => {
  const day = date.getDate()
  return day < 10 ? `0${day}` : day
}

export const getDateString = (date: Date) => {
  return `${getYearString(date)}${getMonthString(date)}${getDayString(date)}`
}

export const formatNumber = (value: number) => {
  return value.toFixed(2).replace('.', '')
}
