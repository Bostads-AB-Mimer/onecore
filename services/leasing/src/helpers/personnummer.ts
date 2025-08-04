import { logger } from 'onecore-utilities'
import personnummer from 'personnummer'

/**
 * Formats personnummer to yymmddxxxx.
 * @param pnrs an array of valid personnummer
 */
export const format = (pnr: string): string => {
  try {
    return personnummer.parse(pnr).format().replace('-', '').replace('+', '')
  } catch (error) {
    logger.error(error, 'Error parsing national identity number ' + pnr)
    throw error
  }
}

export const valid = personnummer.valid
