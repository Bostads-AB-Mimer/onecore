/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('invoice_data', (table) => {
    table.increments('Id').primary()
    table.integer('BatchId').references('invoice_batch.Id')
    table.string('ContractCode')
    table.string('ContactCode')
    table.string('TenantName')
    table.string('ContractType')
    table.string('ContractFromDate')
    table.string('InvoiceFromDate')
    table.string('InvoiceToDate')
    table.string('RentArticle')
    table.string('InvoiceRowText')
    table.string('ContractArea')
    table.string('SumContractArea')
    table.string('RentalObjectCode')
    table.string('RentalObjectName')
    table.string('Amount')
    table.string('Vat')
    table.string('TotalAmount')
    table.string('Account')
    table.string('CostCode')
    table.string('Property')
    table.string('ProjectCode')
    table.string('FreeCode')
    table.string('SumRow')
    table.string('ImportStatus')
    table.datetime('ImportTime')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('invoice_data')
}
