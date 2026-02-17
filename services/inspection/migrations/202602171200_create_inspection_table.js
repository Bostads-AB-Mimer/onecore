/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE inspection (
        id INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        status VARCHAR(50) NOT NULL,
        date DATETIME NOT NULL,
        startedAt DATETIME NULL,
        endedAt DATETIME NULL,
        inspector VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        residenceId VARCHAR(100) NOT NULL,
        address VARCHAR(500) NOT NULL,
        apartmentCode VARCHAR(50) NULL,
        isFurnished BIT NOT NULL DEFAULT 0,
        leaseId VARCHAR(100) NOT NULL,
        isTenantPresent BIT NOT NULL DEFAULT 0,
        isNewTenantPresent BIT NOT NULL DEFAULT 0,
        masterKeyAccess VARCHAR(255) NULL,
        hasRemarks BIT NOT NULL DEFAULT 0,
        notes NVARCHAR(MAX) NULL,
        totalCost DECIMAL(18, 2) NULL,
        remarkCount INT NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        updatedAt DATETIME NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX idx_inspection_residenceId ON inspection(residenceId);
      CREATE INDEX idx_inspection_leaseId ON inspection(leaseId);
      CREATE INDEX idx_inspection_date ON inspection(date);
      CREATE INDEX idx_inspection_status ON inspection(status);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS inspection;`)
  })
}
