/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('tenant', (table) => {
    table.string('TenantLeaseId').references('Lease.LeaseId')
    table.string('TenantPersonId').references('Person.PersonId')
    table.primary(['LeaseId', 'PersonId'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tenant')
}
