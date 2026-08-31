/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE inspection_added_room (
        id INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        inspectionId INT NOT NULL,
        xpandRoomId VARCHAR(15) NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_inspection_added_room_inspection
          FOREIGN KEY (inspectionId) REFERENCES inspection(id) ON DELETE CASCADE,
        CONSTRAINT uq_inspection_added_room
          UNIQUE (inspectionId, xpandRoomId)
      );
      CREATE INDEX idx_inspection_added_room_inspectionId ON inspection_added_room(inspectionId);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS inspection_added_room;`)
  })
}