/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE inspection_remark (
        id INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        roomId INT NOT NULL,
        remarkId VARCHAR(100) NOT NULL,
        location VARCHAR(255) NULL,
        buildingComponent VARCHAR(255) NULL,
        notes NVARCHAR(MAX) NULL,
        remarkGrade INT NOT NULL,
        remarkStatus VARCHAR(100) NULL,
        cost DECIMAL(18, 2) NOT NULL DEFAULT 0,
        invoice BIT NOT NULL DEFAULT 0,
        quantity INT NOT NULL DEFAULT 1,
        isMissing BIT NOT NULL DEFAULT 0,
        fixedDate DATETIME NULL,
        workOrderCreated BIT NOT NULL DEFAULT 0,
        workOrderStatus INT NULL,
        createdAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (roomId) REFERENCES inspection_room(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_inspection_remark_roomId ON inspection_remark(roomId);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS inspection_remark;`)
  })
}
