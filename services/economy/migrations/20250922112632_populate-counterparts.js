/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex('invoice_counterpart').insert([
    {
      CustomerName: 'Bostads AB Mimer',
      CounterpartCode: '10001',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Björnklockan',
      CounterpartCode: '10002',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Garagebolaget Mimer',
      CounterpartCode: '10003',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Mälarenergi',
      CounterpartCode: '10011',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Mälarenergi Tjänster',
      CounterpartCode: '10012',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Mälarenergi Elnät',
      CounterpartCode: '10013',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Mälarenergi Vatten',
      CounterpartCode: '10014',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Fibra',
      CounterpartCode: '10015',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Västerås Stadshus',
      CounterpartCode: '10016',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Västerås Parkeringsbolag',
      CounterpartCode: '10017',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Vafab',
      CounterpartCode: '10021',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Västerås Stad',
      CounterpartCode: '10022',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
  ])
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex('CounterPart')
}
