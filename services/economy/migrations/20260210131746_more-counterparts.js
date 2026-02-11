/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex('invoice_counterpart').insert([
    {
      CustomerName: 'Mälarenergi AB',
      CounterpartCode: '10011',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Mälarenergi Elnät AB',
      CounterpartCode: '10013',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Västerås Parkeringsbolag AB',
      CounterpartCode: '10017',
      LedgerAccount: '1560',
      TotalAccount: '2972',
    },
    {
      CustomerName: 'Västerås Stad (Org.nr 2120002080)',
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
