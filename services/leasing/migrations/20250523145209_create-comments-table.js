/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.transaction(async (trx) => {

  await trx.raw(`
  CREATE TABLE comment (
    id int NOT NULL PRIMARY KEY IDENTITY(1,1),
    targetType nvarchar(30) NOT NULL,
    targetId int NOT NULL,
    authorId nvarchar(100) NOT NULL,
    authorName nvarchar(50) NOT NULL,
    type nvarchar(8) NOT NULL CHECK (type IN ('COMMENT', 'WARNING', 'STOP')),
    comment nvarchar(max) NOT NULL,
    createdAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_thread_id
  ON comment (targetType, targetId);
`)
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.transaction(async (trx) => {

  await trx.raw(`
    DROP TABLE comment;
`)
  })
};
