/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE inspection_room (
        id INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        inspectionId INT NOT NULL,
        roomName VARCHAR(255) NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (inspectionId) REFERENCES inspection(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_inspection_room_inspectionId ON inspection_room(inspectionId);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS inspection_room;`)
  })
}
