import { getPeriodInformationFromDateStrings } from './services/common/adapters/xledger-adapter'

const doStuff = async () => {
  const periodInformation = getPeriodInformationFromDateStrings('2026-09-01', '2026-10-01', '2026-12-31')
  console.log(periodInformation)
}

doStuff()
