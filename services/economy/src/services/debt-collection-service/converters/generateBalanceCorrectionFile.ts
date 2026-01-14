import { EnrichedXledgerBalanceCorrection } from '../../common/types'
import {
  formatNumber,
  getDateString,
  joinStrings,
  leftPad,
  rightPad,
} from './utils'

const Header = "SERGELIDPOST+100284+SERGEL+messages'"
const MimerCustomerId = '1681340'

export default (
  balanceCorrections: EnrichedXledgerBalanceCorrection[],
  createdDate: Date
): string => {
  return joinStrings(
    [
      Header,
      `600${getDateString(createdDate)}`,
      joinStrings(
        balanceCorrections.flatMap(createPostsForBalanceCorrection),
        '\n'
      ),
      createEndPost(balanceCorrections),
    ],
    '\n'
  )
}

const createPostsForBalanceCorrection = (
  balanceCorrection: EnrichedXledgerBalanceCorrection
): string[] => {
  const lines = [
    joinStrings(
      [
        '610',
        MimerCustomerId,
        rightPad('', 7, ' '), // Referensnummer (används inte)
        rightPad(balanceCorrection.contactCode, 16, ' '),
        rightPad(balanceCorrection.invoiceNumber, 20, ' '),
        getDateString(balanceCorrection.date),
        leftPad(formatNumber(balanceCorrection.paidAmount), 12, '0'),
        rightPad('', 60, ' '), // Internt fakturanummer (används inte)
        rightPad('', 20, ' '), // Anläggningsnummer (används inte)
        leftPad(formatNumber(balanceCorrection.remainingAmount), 12, '0'),
      ],
      ''
    ),
  ]

  if (balanceCorrection.hasInvoice && balanceCorrection.lastDebitDate) {
    lines.push(
      joinStrings(
        [
          '660',
          MimerCustomerId,
          rightPad('', 7, ' '), // ?
          rightPad(balanceCorrection.contactCode, 16, ' '),
          rightPad(balanceCorrection.reference, 20, ' '),
          getDateString(balanceCorrection.lastDebitDate),
          rightPad(balanceCorrection.rentalProperty.address, 36, ' '),
          rightPad(
            balanceCorrection.rentalProperty.postalCode?.replaceAll(' ', '') ??
              '',
            5,
            ' '
          ),
          rightPad(balanceCorrection.rentalProperty.city ?? '', 28, ' '),
          '99',
        ],
        ''
      )
    )
  }

  return lines
}

const createEndPost = (
  balanceCorrections: EnrichedXledgerBalanceCorrection[]
) => {
  return joinStrings([
    '699',
    leftPad(
      balanceCorrections.length +
        balanceCorrections.filter((bc) => bc.hasInvoice && bc.lastDebitDate)
          .length +
        2, // + 2 because the 600 post and this 699 post are also counted...
      10,
      '0'
    ),
  ])
}
