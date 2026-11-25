/**
 * Guide subcategories: a category may have a parent category, one level
 * deep. The adapter rejects a parent that is itself a subcategory.
 *
 * Names are unique per parent. SQL Server treats NULLs as equal in a unique
 * index, so (parentId, name) also keeps top-level names unique.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE guide_category ADD parentId UNIQUEIDENTIFIER NULL
        CONSTRAINT fk_guide_category_parent
        FOREIGN KEY REFERENCES guide_category(id);
    `)
    await trx.raw(`
      DROP INDEX uq_guide_category_name ON guide_category;
      CREATE UNIQUE INDEX uq_guide_category_parent_name
        ON guide_category(parentId, name);
    `)
  })
}

/**
 * Fails while two subcategories share a name, since names are then unique
 * across all categories again.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      DROP INDEX uq_guide_category_parent_name ON guide_category;
      ALTER TABLE guide_category DROP CONSTRAINT fk_guide_category_parent;
      ALTER TABLE guide_category DROP COLUMN parentId;
      CREATE UNIQUE INDEX uq_guide_category_name ON guide_category(name);
    `)
  })
}
